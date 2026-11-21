<?php

namespace App\Console\Commands;

use App\Jobs\BackfillRecipesChunk;
use App\Models\RecipeEmbedding;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Rebuilds the SEMANTIC layer (slice 6 ops — see docs/recipe-dedup.md):
 * wipes recipe_embeddings (status/text hashes — so every recipe re-embeds
 * with the CURRENT model + text builder) and re-walks the fingerprints via
 * the ordinary backfill chain.
 *
 * Strategy, deliberately zero-infra (QdrantVectorStore is frozen):
 *   - fingerprint rows / duplicate pairs / checks are NEVER touched;
 *   - status rows are deleted in ID WINDOWS of 5000 (a single DELETE on a
 *     large table would hold one huge transaction on MySQL);
 *   - vector points are NOT dropped: the next ensureEmbedded() upserts by
 *     the same id, so Qdrant points are OVERWRITTEN in place; orphaned
 *     points of deleted recipes are only reachable without payload and
 *     ignored by search (EmbeddingService::remove already cleans the
 *     normal path). Operators who want a pristine collection point the
 *     collection name at a fresh one instead (DEDUP_QDRANT_COLLECTION);
 *   - recipe_dedup.embeddings.rebuild_pending is set until the backfill
 *     chain finishes, so dedup-status reports the rebuild honestly.
 */
final class DedupRebuildEmbeddingsCommand extends Command
{
    protected $signature = 'recipereal:dedup-rebuild-embeddings {--force}';

    protected $description = 'Rebuild: wipe recipe_embeddings status rows + re-index every recipe via backfill.';

    private const DELETE_WINDOW = 5000;

    public function handle(): int
    {
        $rows = (int) RecipeEmbedding::query()->count();

        if (! (bool) $this->option('force')) {
            $this->line('This will REBUILD the semantic layer:');
            $this->line(sprintf('  - DELETE %d recipe_embeddings status rows (they get rebuilt);', $rows));
            $this->line('  - re-run fingerprint extraction + embedding for EVERY recipe via the backfill chain;');
            $this->line('  - fingerprints, duplicate pairs and duplicate checks are NOT touched;');
            $this->line('  - Qdrant points are overwritten in place by recipe id (NOT dropped).');

            if (! $this->confirm('Proceed with the embeddings rebuild?')) {
                $this->line('Aborted — nothing was deleted.');

                return self::SUCCESS;
            }
        }

        $deleted = 0;

        // ID-window deletes: bounded transactions, resumable, MySQL-safe.
        $maxId = (int) RecipeEmbedding::query()->max('id');

        for ($windowStart = 1; $maxId > 0 && $windowStart <= $maxId; $windowStart += self::DELETE_WINDOW) {
            $deleted += RecipeEmbedding::query()
                ->where('id', '>=', $windowStart)
                ->where('id', '<', $windowStart + self::DELETE_WINDOW)
                ->delete();
        }

        // The backfill will re-extract fingerprints (mostly a skip: current
        // version) + embed every recipe with the current model/text.
        Cache::forever(BackfillRecipesChunk::REBUILD_PENDING_KEY, true);
        Cache::forget(BackfillRecipesChunk::DONE_KEY);

        BackfillRecipesChunk::dispatch(1, max(1, (int) config('recipe_dedup.backfill.chunk', 200)));

        Log::info(sprintf('[recipe-dedup rebuild] %d embedding status rows deleted; backfill re-dispatched.', $deleted));

        $this->info(sprintf(
            'Deleted %d recipe_embedding status row(s); backfill chunk #1 dispatched — embeddings rebuild is now PENDING until the chain finishes.',
            $deleted,
        ));
        $this->line('Watch it with: php artisan recipereal:dedup-status');

        return self::SUCCESS;
    }
}
