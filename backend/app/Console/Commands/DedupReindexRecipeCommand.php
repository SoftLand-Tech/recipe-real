<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Models\RecipeEmbedding;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintCollisionException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Console\Command;
use Throwable;

/**
 * Force ONE recipe through fingerprint extraction + registration and
 * embedding — inline, fail-soft surfaced via the exit code only:
 *
 *   - fingerprint unknown/rebuild: register() replaces the row (same
 *     recipe_id) with freshly extracted identity + hashes;
 *   - embedding: ensureIndexedGivenIdentity() — the text-hash skip makes
 *     unchanged recipes a genuine no-op; changed content re-embeds.
 *
 * Exit 1 when the recipe id is unknown or extraction blows up (a collided
 * fingerprint is REPORTED inline — the exact-duplicate pair already exists
 * in review; the command still succeeds because nothing was broken).
 */
final class DedupReindexRecipeCommand extends Command
{
    protected $signature = 'recipereal:dedup-reindex-recipe {recipe_id}';

    protected $description = 'Re-extract + re-register + re-embed a single recipe (dedup indexing).';

    public function handle(FingerprintService $fingerprints, EmbeddingService $embeddings): int
    {
        $recipe = Recipe::query()->find((int) $this->argument('recipe_id'));

        if ($recipe === null) {
            $this->error(sprintf('Recipe #%s does not exist.', (string) $this->argument('recipe_id')));

            return self::FAILURE;
        }

        try {
            $fingerprint = $fingerprints->register($recipe);
        } catch (FingerprintCollisionException $e) {
            $this->line(sprintf(
                'Recipe #%d exactly matches an existing recipe (exact duplicated content): %s',
                $recipe->id,
                $e->getMessage(),
            ));
            $this->line('The duplicate pair is (or should be) flagged for review — see recipereal:dedup-status.');

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error(sprintf('Reindexing recipe #%d failed: %s', $recipe->id, $e->getMessage()));

            return self::FAILURE;
        }

        $embeddingStatus = $embeddings->ensureIndexedGivenIdentity(
            $recipe,
            $fingerprints->deserializeIdentity($fingerprint->identity),
            $fingerprint,
        );

        $embedding = RecipeEmbedding::query()->where('recipe_id', $recipe->id)->first();

        $this->info(sprintf('Recipe #%d reindexed.', $recipe->id));
        $this->line('fingerprint    : '.mb_substr((string) $fingerprint->fingerprint, 0, 24).'…');
        $this->line('  identity_sig : '.mb_substr((string) $fingerprint->identity_signature, 0, 24).'…');
        $this->line('  main_ingr    : '.mb_substr((string) $fingerprint->main_ingredient_hash, 0, 24).'…');
        $this->line('  is_complete  : '.($fingerprint->is_complete ? 'true' : 'false'));
        $this->line('embedding      : '.$embeddingStatus.($embedding !== null
            ? sprintf(' (status=%s attempts=%d model=%s)', $embedding->status, $embedding->attempts, $embedding->model ?? '—')
            : ''));

        return self::SUCCESS;
    }
}
