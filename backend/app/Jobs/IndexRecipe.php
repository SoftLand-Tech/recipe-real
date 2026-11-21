<?php

namespace App\Jobs;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintCollisionException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Single (re)index of one recipe — the hook the RecipePublisher publish
 * flow fires after commit (slice 6 ops, docs/recipe-dedup.md):
 *
 *   1. when recipe_dedup.enabled is false this is a no-op;
 *   2. the (possibly deleted) recipe row is fetched;
 *   3. FingerprintService::register() re-extracts + upserts the fingerprint;
 *   4. EmbeddingService::ensureIndexedGivenIdentity() records the embedding.
 *
 * Everything is fail-soft: permanent failures are logged (and, when
 * embeddings are in play, already recorded on recipe_embeddings), never
 * rethrown — a broken dedup engine must never break publishing. The job is
 * cheap on every publish because unchanged recipes are never re-embedded
 * (text-hash skip) and unchanged identities are skipped upstream.
 */
final class IndexRecipe implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public const SOURCE_COLLISION = 'auto_review';

    public int $tries = 2;

    public function backoff(): array
    {
        return [30, 120];
    }

    public function __construct(public readonly int $recipeId)
    {
        $queue = config('recipe_dedup.indexing.queue');

        if (is_string($queue) && $queue !== '') {
            $this->onQueue($queue);
        }
    }

    public function handle(
        FingerprintService $fingerprints,
        EmbeddingService $embeddings,
    ): void {
        if (! (bool) config('recipe_dedup.enabled')) {
            return;
        }

        $recipe = Recipe::query()->find($this->recipeId);

        if ($recipe === null) {
            return;
        }

        try {
            $fingerprint = $fingerprints->register($recipe);
            $identity = $fingerprints->deserializeIdentity($fingerprint->identity);
            $embeddings->ensureIndexedGivenIdentity($recipe, $identity, $fingerprint);
        } catch (FingerprintCollisionException) {
            // The published recipe EXACTLY equals an already-registered one:
            // record the pair + a needs_review check so an operator can
            // resolve it (source auto_review, layer 1). No vector write.
            $this->recordCollision($recipe, $fingerprints);
        } catch (Throwable $e) {
            Log::warning(sprintf(
                '[recipe-dedup indexing] recipe #%d could not be indexed: %s',
                $this->recipeId,
                $e->getMessage(),
            ));
        }
    }

    private function recordCollision(Recipe $recipe, FingerprintService $fingerprints): void
    {
        Log::warning(sprintf(
            '[recipe-dedup indexing] recipe #%d exactly matches an existing recipe; flagged for review.',
            $this->recipeId,
        ));

        try {
            $candidate = CandidateRecipe::fromRecipe($recipe);
            $set = $fingerprints->fingerprintSet($candidate, $fingerprints->identity($candidate));

            // The register attempt failed on the UNIQUE fingerprint, so the
            // holder is another recipe; the earliest id names the original.
            $holder = RecipeFingerprint::query()
                ->where('fingerprint', $set->fingerprint)
                ->where('recipe_id', '!=', $this->recipeId)
                ->orderBy('recipe_id')
                ->first();
        } catch (Throwable $e) {
            Log::warning(sprintf(
                '[recipe-dedup indexing] collision fingerprint for recipe #%d unresolvable: %s',
                $this->recipeId,
                $e->getMessage(),
            ));

            return;
        }

        if ($holder === null) {
            return;
        }

        RecipeDuplicatePair::query()->updateOrCreate(
            ['recipe_id' => $this->recipeId, 'duplicate_of_recipe_id' => (int) $holder->recipe_id],
            [
                'source' => 'engine',
                'status' => RecipeDuplicatePair::STATUS_FLAGGED,
                'note' => 'cpu exact fingerprint collision during publish-time indexing',
            ],
        );

        DuplicateCheck::query()->firstOrCreate(
            [
                'recipe_id' => $this->recipeId,
                'matched_recipe_id' => (int) $holder->recipe_id,
                'source' => self::SOURCE_COLLISION,
                'action' => DuplicateCheck::ACTION_FLAGGED_REVIEW,
            ],
            [
                'layer' => 1,
                'is_duplicate' => null,
                'reason' => 'exact fingerprint collision during publish-time indexing; pair recorded',
                'status' => DuplicateCheck::STATUS_NEEDS_REVIEW,
            ],
        );
    }
}
