<?php

namespace App\Console\Commands;

use App\Jobs\BackfillRecipesChunk;
use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\VectorStore;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Throwable;

/**
 * Operator status report for the dedup engine (slice 6 ops — see
 * docs/recipe-dedup.md). COUNTS ONLY — every figure comes from an indexed
 * aggregate query (groupBy counts) or the config/cache, never from loaded
 * rows, so it is safe against a production-sized table.
 */
final class DedupStatusCommand extends Command
{
    protected $signature = 'recipereal:dedup-status';

    protected $description = 'Dedup engine status: config, fingerprints, embeddings, checks, vector store, backfill cursor.';

    public function handle(VectorStore $store): int
    {
        $enabled = (bool) config('recipe_dedup.enabled');

        $this->info('=== recipe dedup engine status ===');

        $rows = [
            ['engine enabled', $enabled ? 'yes' : 'no'],
            ['fingerprints enabled', 'always (deterministic layer)'],
            ['embeddings enabled', (bool) config('recipe_dedup.embeddings.enabled') ? 'yes' : 'no'],
            ['indexing hooks enabled', (bool) config('recipe_dedup.indexing.enabled') ? 'yes' : 'no'],
            ['embed_immediately', (bool) config('recipe_dedup.indexing.embed_immediately') ? 'yes' : 'no'],
            ['vector driver', self::labelled((string) config('recipe_dedup.vector.driver', 'none'), $store->enabled() ? 'enabled' : 'disabled')],
            ['recipes (max id)', (string) ((int) Recipe::query()->max('id'))],
        ];

        foreach ($rows as [$label, $value]) {
            $this->line(self::row($label, $value));
        }

        $this->line('');

        // recipe_fingerprints — one count + one grouped count, no row loads.
        $this->line(self::row('fingerprint rows', (string) RecipeFingerprint::query()->count()));

        $byCompleteness = RecipeFingerprint::query()
            ->selectRaw('is_complete, COUNT(*) AS n')
            ->groupBy('is_complete')
            ->get();

        $complete = (int) ($byCompleteness->first(fn ($row): bool => (bool) $row->is_complete)->n ?? 0);
        $incomplete = (int) ($byCompleteness->first(fn ($row): bool => ! (bool) $row->is_complete)->n ?? 0);

        $this->line(self::row('  fingerprints is_complete=true', (string) $complete));
        $this->line(self::row('  fingerprints is_complete=false', (string) $incomplete));

        $this->line('');

        // recipe_embeddings grouped by status — grouped count only.
        $embeddingStatuses = RecipeEmbedding::query()
            ->selectRaw('status, COUNT(*) AS n')
            ->groupBy('status')
            ->pluck('n', 'status');

        $this->line(self::row('embedding rows', (string) $embeddingStatuses->sum()));

        foreach ([RecipeEmbedding::STATUS_PENDING, RecipeEmbedding::STATUS_INDEXED, RecipeEmbedding::STATUS_FAILED] as $status) {
            $this->line(self::row(sprintf('  embeddings %-8s', $status), (string) ($embeddingStatuses[$status] ?? 0)));
        }

        $this->line('');

        // duplicate_checks grouped by source/action — grouped count only.
        $checks = DuplicateCheck::query()
            ->selectRaw('source, action, COUNT(*) AS n')
            ->groupBy('source', 'action')
            ->orderBy('source')
            ->orderBy('action')
            ->get();

        $this->line(self::row('duplicate checks', (string) $checks->sum('n')));

        foreach ($checks as $check) {
            $this->line(self::row(sprintf('  %s / %s', $check->source, $check->action), (string) $check->n));
        }

        $this->line(self::row('duplicate pairs flagged', (string) RecipeDuplicatePair::query()->where('status', RecipeDuplicatePair::STATUS_FLAGGED)->count()));
        $this->line(self::row('duplicate pairs by status', (string) RecipeDuplicatePair::query()
            ->selectRaw('status, COUNT(*) AS n')->groupBy('status')->get()->map(fn ($row): string => sprintf('%s=%d', $row->status, $row->n))->implode(', ')));

        $this->line('');

        $this->line(self::row('vector store ping', self::pingLine($store)));
        $this->line(self::row('vector collection', $store->collection()));
        $this->line('  hint: point counts live in the Qdrant console (GET /collections/{name});'
            .' rows above drive indexing, not the vector DB.');

        $this->line('');

        $this->renderBackfill();

        return self::SUCCESS;
    }

    private function renderBackfill(): void
    {
        $cursor = Cache::get(BackfillRecipesChunk::CURSOR_KEY);
        $done = Cache::get(BackfillRecipesChunk::DONE_KEY);
        $running = Cache::get(BackfillRecipesChunk::RUNNING_KEY);
        $rebuildPending = Cache::get(BackfillRecipesChunk::REBUILD_PENDING_KEY);

        $this->line(self::row('backfill cursor (last id)', $cursor !== null ? (string) (int) $cursor : 'not started'));
        $this->line(self::row('backfill done', $done ? 'yes' : ($cursor !== null ? 'no' : '—')));
        $this->line(self::row('backfill running', $running !== null
            ? sprintf('since %s%s', date('Y-m-d H:i:s', (int) $running), $this->staleSuffix((int) $running))
            : 'no'));
        $this->line(self::row('embeddings rebuild pending', $rebuildPending ? 'yes (run dedup-status until counts recover)' : 'no'));
    }

    /** @return string ' (stale? older than 30 min)' when the run looks stuck. */
    private function staleSuffix(int $runningSince): string
    {
        return (now()->getTimestamp() - $runningSince) > 1800 ? ' — STALE? (older than 30 min)' : '';
    }

    private function pingLine(VectorStore $store): string
    {
        try {
            if ($store->ping()) {
                return 'OK — reachable';
            }

            return 'UNREACHABLE — ping failed (run dedup-check-vector for details)';
        } catch (Throwable $e) {
            return sprintf('UNREACHABLE — %s (run dedup-check-vector for details)', $e->getMessage());
        }
    }

    private static function labelled(string $value, string $label): string
    {
        return $value === '' ? $label : $value.' ('.$label.')';
    }

    private static function row(string $label, string $value): string
    {
        return str_pad($label, 34, ' ').' : '.$value;
    }
}
