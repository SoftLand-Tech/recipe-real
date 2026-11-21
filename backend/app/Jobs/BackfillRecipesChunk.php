<?php

namespace App\Jobs;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintCollisionException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * One chunk of the RESUMABLE backfill over existing recipes (slice 6 ops —
 * see docs/recipe-dedup.md). Chained, id-cursor windowed, lock-free:
 *
 *   - processes `recipes` with `recipes.id >= $startId ORDER BY id LIMIT
 *     $chunkSize` — each row is processed FULLY before the next (never an
 *     unbounded array).
 *   - a recipe holding a fingerprint row with the CURRENT
 *     CulinaryIdentity::VERSION is skipped (fresh) — re-extracted when the
 *     stored version is STALE, which is exactly how a CulinaryIdentity
 *     version bump re-processes the table for rebuilds.
 *   - FingerprintCollisionException => the recipe EXACTLY equals another
 *     registered recipe: a recipe_duplicate_pairs row (engine/flagged) plus
 *     a duplicate_checks row (source backfill, layer 1, action
 *     flagged_review, status needs_review) are recorded — recipes are never
 *     deleted — and NO vector write happens for the collided recipe. The
 *     collision never stops the chunk.
 *   - when embeddings are enabled (config recipe_dedup.embeddings.enabled +
 *     a live vector store + recipe_dedup.indexing.embed_immediately)
 *     EmbeddingService::ensureIndexedGivenIdentity() runs fail-soft: a
 *     failed embedding becomes a failed recipe_embeddings row, never an
 *     exception escaping the job.
 *   - after EVERY recipe the cache cursor `recipe_dedup.backfill.cursor`
 *     moves to the processed id (Cache::forever — the production cache
 *     store is `database`, so the cursor survives restarts far beyond any
 *     sane TTL) and `recipe_dedup.backfill.running` holds the chunk-start
 *     timestamp for stale-run detection.
 *   - when more rows exist the NEXT chunk ($lastId + 1) is dispatched, so
 *     the chain walks the whole table. `$dispatch_ahead` is documented as
 *     RESERVED: each chunk dispatches only its successor once finished
 *     (never ahead), which keeps in-flight chunks naturally at ~1 — simple,
 *     correct, and the config key stays honest without semaphore bookkeeping.
 *   - when no rows remain: `recipe_dedup.backfill.done` (forever) is set,
 *     the running flag cleared and nothing more dispatched.
 *
 * Per-recipe Throwables are caught, logged and counted — the job fails only
 * on systemic errors (e.g. database down) so the normal retry/backoff
 * machinery applies, and the idempotent per-row work (skip-if-fresh,
 * updateOrCreate fingerprints, text-hash-skip embeddings) makes re-runs of
 * any partially processed window free. handle() returns a counts summary
 * (used by `recipereal:dedup-index --sync`, ignored by the queue).
 *
 * Cache keys (see docs/recipe-dedup.md): recipe_dedup.backfill.{cursor,
 * running, done} and recipe_dedup.embeddings.rebuild_pending.
 */
final class BackfillRecipesChunk implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Cache key: last processed recipe id (forever). */
    public const CURSOR_KEY = 'recipe_dedup.backfill.cursor';

    /** Cache key: unix timestamp of the running backfill (forever). */
    public const RUNNING_KEY = 'recipe_dedup.backfill.running';

    /** Cache key: true when the walk reached the last recipe (forever). */
    public const DONE_KEY = 'recipe_dedup.backfill.done';

    /** Cache key: true while an embeddings rebuild awaits backfill completion. */
    public const REBUILD_PENDING_KEY = 'recipe_dedup.embeddings.rebuild_pending';

    public int $tries = 3;

    public int $timeout = 900;

    /**
     * The --sync command calls handle() directly; it sets this to false so
     * the chunk walks the table itself instead of also queueing jobs.
     */
    public bool $chain = true;

    public function __construct(
        public readonly int $startId,
        public readonly int $chunkSize,
    ) {
        $queue = config('recipe_dedup.backfill.queue');

        if (is_string($queue) && $queue !== '') {
            $this->onQueue($queue);
        }
    }

    public function backoff(): array
    {
        return [30, 120, 300];
    }

    /**
     * @return array<string, int|null> counts + last_id (null when the
     *                                 `[startId, startId+chunk)` window was empty)
     */
    public function handle(
        FingerprintService $fingerprints,
        EmbeddingService $embeddings,
        VectorStore $store,
    ): array {
        $recipes = Recipe::query()
            ->where('recipes.id', '>=', $this->startId)
            ->orderBy('recipes.id')
            ->limit($this->chunkSize)
            ->get();

        Cache::forever(self::RUNNING_KEY, now()->getTimestamp());

        if ($recipes->isEmpty()) {
            Cache::forget(self::RUNNING_KEY);
            Cache::forever(self::DONE_KEY, true);
            Cache::forget(self::REBUILD_PENDING_KEY);

            Log::info(sprintf(
                '[recipe-dedup backfill] chunk %d.. found nothing; backfill marked done.',
                $this->startId,
            ));

            return ['processed' => 0, 'registered' => 0, 'skipped' => 0, 'collisions' => 0, 'embedding_failed' => 0, 'failed' => 0, 'last_id' => null];
        }

        // One bounded IN query per chunk locates existing fingerprints; the
        // (recipe_id => version) map decides skip vs (re-)registration.
        $versions = RecipeFingerprint::query()
            ->whereIn('recipe_id', $recipes->modelKeys())
            ->pluck('version', 'recipe_id');

        $currentVersion = CulinaryIdentity::VERSION;
        $counts = ['processed' => 0, 'registered' => 0, 'skipped' => 0, 'collisions' => 0, 'embedding_failed' => 0, 'failed' => 0];

        foreach ($recipes as $recipe) {
            $recipeId = (int) $recipe->id;

            try {
                if ((int) ($versions[$recipeId] ?? 0) === $currentVersion) {
                    $counts['skipped']++;
                    Cache::forever(self::CURSOR_KEY, $recipeId);

                    continue;
                }

                $this->processRecipe($recipe, $fingerprints, $embeddings, $store, $counts);
            } catch (Throwable $e) {
                // A per-recipe failure (extraction, storage, …) never stops
                // the chunk; the cursor still moves past it.
                $counts['failed']++;
                Log::warning(sprintf(
                    '[recipe-dedup backfill] recipe #%d failed: %s',
                    $recipeId,
                    $e->getMessage(),
                ));
            }

            $counts['processed']++;
            Cache::forever(self::CURSOR_KEY, $recipeId);
        }

        $lastId = (int) $recipes->last()->id;
        $moreExists = Recipe::query()->where('id', '>', $lastId)->exists();

        if ($moreExists) {
            if ($this->chain) {
                self::dispatch($lastId + 1, $this->chunkSize);
            }
        } else {
            // Walk over: the running flag has nothing left to describe.
            Cache::forever(self::DONE_KEY, true);
            cache()->forget(self::RUNNING_KEY);
            Cache::forget(self::REBUILD_PENDING_KEY);
        }

        Log::info($this->summaryLine($this->startId, $lastId, $counts, $moreExists));

        return [...$counts, 'last_id' => $lastId];
    }

    /**
     * The one-line chunk summary also used for the --sync console output
     * (the queued run relies on the Log::info twin — jobs have no console).
     *
     * @param  array<string, int>  $counts
     */
    private function summaryLine(int $startId, int $lastId, array $counts, bool $moreExists): string
    {
        return sprintf(
            '[recipe-dedup backfill] chunk %d..%d: processed=%d skipped=%d registered=%d collisions=%d embedding_failed=%d failed=%d more=%s',
            $startId,
            $lastId,
            $counts['processed'],
            $counts['skipped'],
            $counts['registered'],
            $counts['collisions'],
            $counts['embedding_failed'],
            $counts['failed'],
            $moreExists ? 'yes' : 'no',
        );
    }

    private function processRecipe(
        Recipe $recipe,
        FingerprintService $fingerprints,
        EmbeddingService $embeddings,
        VectorStore $store,
        array &$counts,
    ): void {
        $candidate = CandidateRecipe::fromRecipe($recipe);
        $identity = $fingerprints->identity($candidate);

        try {
            $fingerprint = $fingerprints->register($recipe, $candidate);
        } catch (FingerprintCollisionException) {
            $this->recordCollision($recipe, $candidate, $identity, $fingerprints, $counts);

            return;
        }

        $counts['registered']++;

        $this->maybeEmbed($recipe, $identity, $fingerprint, $embeddings, $store, $counts);
    }

    private function recordCollision(
        Recipe $recipe,
        CandidateRecipe $candidate,
        CulinaryIdentity $identity,
        FingerprintService $fingerprints,
        array &$counts,
    ): void {
        $holder = RecipeFingerprint::query()
            ->where('fingerprint', $fingerprints->fingerprintSet($candidate, $identity)->fingerprint)
            ->orderBy('recipe_id')
            ->first();

        if ($holder === null) {
            // Raced deletion of the exact holder — nothing to pair against;
            // logged + counted, the recipe stays fully unindexed.
            $counts['failed']++;
            Log::warning(sprintf(
                '[recipe-dedup backfill] recipe #%d collided with an unresolvable fingerprint holder.',
                $recipe->id,
            ));

            return;
        }

        // flagFromEngine never regresses a human verdict on a re-walk (the
        // collided recipe has no fingerprint row, so rebuild passes revisit
        // it — manual distinct/duplicate decisions must survive that).
        RecipeDuplicatePair::flagFromEngine(
            (int) $recipe->id,
            (int) $holder->recipe_id,
            'engine',
            'cpu exact fingerprint collision during backfill',
        );

        // duplicate_checks is append-only; guard against re-recording the
        // same backfill detection when a chunk window is retried.
        DuplicateCheck::query()->firstOrCreate(
            [
                'recipe_id' => (int) $recipe->id,
                'matched_recipe_id' => (int) $holder->recipe_id,
                'source' => DuplicateCheck::SOURCE_BACKFILL,
                'action' => DuplicateCheck::ACTION_FLAGGED_REVIEW,
            ],
            [
                'layer' => 1,
                'is_duplicate' => null,
                'reason' => 'exact fingerprint collision during backfill; pair recorded',
                'status' => DuplicateCheck::STATUS_NEEDS_REVIEW,
            ],
        );

        $counts['collisions']++;
    }

    private function maybeEmbed(
        Recipe $recipe,
        CulinaryIdentity $identity,
        RecipeFingerprint $fingerprint,
        EmbeddingService $embeddings,
        VectorStore $store,
        array &$counts,
    ): void {
        $immediate = (bool) config('recipe_dedup.indexing.embed_immediately');

        if (! (bool) config('recipe_dedup.embeddings.enabled')
            || ! $immediate
            || ! $store->enabled()
        ) {
            return;
        }

        $status = $embeddings->ensureIndexedGivenIdentity($recipe, $identity, $fingerprint);

        if ($status === 'failed') {
            $counts['embedding_failed']++;
        }
    }
}
