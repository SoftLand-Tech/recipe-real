<?php

namespace App\Services\RecipeDedup\Embeddings;

use App\Models\Recipe;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\EmbeddingException;
use Throwable;

/**
 * Orchestrates recipe-embedding bookkeeping: decides which recipes need an
 * embedding (identity/hash change detection), calls the provider (batched),
 * upserts the vector store point and records per-recipe status in
 * recipe_embeddings so backfills are resumable and unchanged recipes are
 * never re-embedded.
 *
 * ALL methods FAIL SOFT: exceptions from the provider/store (which are
 * EmbeddingException/VectorStoreException by contract, plus anything
 * unexpected) are recorded as row status (status failed + last_error +
 * attempts), never rethrown — indexing must never break recipe publishing
 * or generation. Return values are 'indexed'|'failed'|'skipped' strings.
 */
final class EmbeddingService
{
    public function __construct(
        private readonly EmbeddingProvider $provider,
        private readonly VectorStore $store,
    ) {}

    /**
     * Index/embed one recipe given its already-extracted identity.
     *
     * @param  ?RecipeFingerprint  $fingerprint  recorded into the vector payload for retrieval joins
     * @return string 'indexed'|'failed'|'skipped'
     */
    public function ensureIndexedGivenIdentity(
        Recipe|int $recipe,
        ?CulinaryIdentity $identity,
        ?RecipeFingerprint $fingerprint = null,
    ): string {
        $row = [
            'recipe_id' => $recipe instanceof Recipe ? (int) $recipe->id : (int) $recipe,
            'recipe' => $recipe instanceof Recipe ? $recipe : null,
            'identity' => $identity,
            'fingerprint' => $fingerprint,
        ];

        return $this->run([$row])[(int) $row['recipe_id']];
    }

    /**
     * Batch variant for backfills/generation batches — one provider call
     * per chunk of config('recipe_dedup.embeddings.batch_size'), one
     * upsertMany per chunk.
     *
     * @param  list<array{recipe_id: int, identity: ?CulinaryIdentity, fingerprint: ?RecipeFingerprint}>  $rows
     * @return array<int, string> recipe ids => 'indexed'|'failed'|'skipped'
     */
    public function ensureIndexedBatch(array $rows): array
    {
        return $this->run(array_map(fn (array $row): array => [
            'recipe_id' => (int) $row['recipe_id'],
            'recipe' => $row['recipe'] ?? null,
            'identity' => $row['identity'] ?? null,
            'fingerprint' => $row['fingerprint'] ?? null,
        ], array_values($rows)));
    }

    /**
     * Delete hook: remove the vector point + the status row. Fail-soft —
     * a store outage must never break recipe deletion (the point orphan is
     * harmless: payload-less hits are skipped by search()).
     */
    public function remove(Recipe|int $recipe): void
    {
        $recipeId = $recipe instanceof Recipe ? (int) $recipe->id : (int) $recipe;

        try {
            $this->store->delete($recipeId);
        } catch (Throwable) {
            // Row deletion below still happens; orphaned points are ignored
            // by search. No status row left to record on purpose.
        }

        RecipeEmbedding::query()->where('recipe_id', $recipeId)->delete();
    }

    /**
     * The status row for one recipe (so slice 4/6 can branch cheaply).
     */
    public function status(Recipe|int $recipe): ?RecipeEmbedding
    {
        $recipeId = $recipe instanceof Recipe ? (int) $recipe->id : (int) $recipe;

        return RecipeEmbedding::query()->where('recipe_id', $recipeId)->first();
    }

    /**
     * The single classification + embedding pipeline (single and batch are
     * the same code path — skeleton of the brief's algorithm, steps 1-7).
     *
     * @param  list<array{recipe_id: int, recipe: ?Recipe, identity: ?CulinaryIdentity, fingerprint: ?RecipeFingerprint}>  $rows
     * @return array<int, string>
     */
    private function run(array $rows): array
    {
        $results = [];

        // Step 1 — dead guard: embeddings off, vector store off, or the
        // 'none' protocol provider → 'skipped'; NO row upsert, leave quiet.
        if (
            ! (bool) config('recipe_dedup.embeddings.enabled', true)
            || ! $this->store->enabled()
            || $this->provider->key() === 'none'
        ) {
            foreach ($rows as $row) {
                $results[$row['recipe_id']] = 'skipped';
            }

            return $results;
        }

        // Steps 2-3 — classify: failed-early (no identity), skipped
        // (unchanged hash → no provider call, no vector write) or pending.
        $pending = [];

        foreach ($rows as $row) {
            $recipe = $row['recipe'] ?? Recipe::query()->find($row['recipe_id']);

            if (! $recipe instanceof Recipe) {
                // Unknown recipe: nothing to index, nothing to mark.
                $results[$row['recipe_id']] = 'skipped';

                continue;
            }

            $identity = $row['identity'];

            if (
                $identity === null
                || self::recipeCarriesNoIdentity($recipe)
                || EmbeddingTextBuilder::build($identity) === ''
            ) {
                $this->recordFailed($row['recipe_id'], 'identity_unavailable', 0);
                $results[$row['recipe_id']] = 'failed';

                continue;
            }

            $model = $this->provider->model();
            $textHash = EmbeddingTextBuilder::signature($identity, $model);

            $existing = RecipeEmbedding::query()->where('recipe_id', $row['recipe_id'])->first();

            if (
                $existing !== null
                && $existing->status === RecipeEmbedding::STATUS_INDEXED
                && $existing->text_hash === $textHash
                && $existing->model === $model
            ) {
                // CRITICAL cheap change detection: no provider call, no
                // vector write, not even an attempts bump.
                $results[$row['recipe_id']] = 'skipped';

                continue;
            }

            $row['recipe'] = $recipe; // resolved, stored for the embed phase
            $pending[] = $row + ['text' => EmbeddingTextBuilder::build($identity), 'text_hash' => $textHash, 'model' => $model];
        }

        if ($pending === []) {
            return $results;
        }

        // Steps 4-5 — ONE provider call per chunk, then ensureCollection +
        // one upsertMany with one point per recipe.
        $batchSize = max(1, (int) config('recipe_dedup.embeddings.batch_size', 64));

        foreach (array_chunk($pending, $batchSize) as $chunk) {
            $this->embedChunk($chunk, $results);
        }

        return $results;
    }

    /**
     * Embed + store one chunk. Every outcome records row status; nothing
     * throws.
     *
     * @param  list<array{recipe_id: int, recipe: Recipe, identity: CulinaryIdentity, fingerprint: ?RecipeFingerprint, text: string, text_hash: string, model: string}>  $chunk
     * @param  array<int, string>  $results
     */
    private function embedChunk(array $chunk, array &$results): void
    {
        $texts = array_map(fn (array $row): string => $row['text'], $chunk);

        // Step 4 — provider call. attempts increments per provider attempt
        // (no cap here on purpose: this table is observability, slice 6's
        // backfill job enforces its own retry budget on top).
        try {
            $embedding = $this->provider->embed($texts);
        } catch (Throwable $e) {
            foreach ($chunk as $row) {
                $this->recordFailed($row['recipe_id'], $e->getMessage(), 1);
                $results[$row['recipe_id']] = 'failed';
            }

            return;
        }

        $vectors = is_array($embedding->vectors) ? $embedding->vectors : [];

        if (count($vectors) < count($chunk)) {
            foreach ($chunk as $row) {
                // Index alignment must survive fully or nothing is stored.
                $this->recordFailed($row['recipe_id'], 'embedding provider returned fewer vectors than texts', 1);
                $results[$row['recipe_id']] = 'failed';
            }

            return;
        }

        // Step 5 — vector write. One store exception fails every attempted
        // row of this chunk (rows already skipped stay untouched).
        try {
            $this->store->ensureCollection($embedding->dimensions);

            $points = [];

            foreach (array_values($chunk) as $i => $row) {
                $points[] = [
                    'id' => (int) $row['recipe_id'],
                    'vector' => $vectors[$i],
                    'payload' => $this->pointPayload($row['recipe'], $row['identity'], $row['fingerprint'], $row['model']),
                ];
            }

            $this->store->upsertMany($points);

            foreach ($chunk as $row) {
                $this->recordIndexed($row, $embedding->dimensions);
                $results[$row['recipe_id']] = 'indexed';
            }
        } catch (Throwable $e) {
            foreach ($chunk as $row) {
                $this->recordFailed($row['recipe_id'], 'vector store: '.$e->getMessage(), 1);
                $results[$row['recipe_id']] = 'failed';
            }
        }
    }

    /**
     * Step 5 payload — one point per recipe, fingerprint included so
     * retrieval can join candidates without a second lookup.
     *
     * @return array<string, mixed>
     */
    private function pointPayload(
        Recipe $recipe,
        CulinaryIdentity $identity,
        ?RecipeFingerprint $fingerprint,
        string $model,
    ): array {
        return [
            'recipe_id' => (int) $recipe->id,
            'canonical_dish' => $identity->canonicalDish,
            'dish_family' => $identity->dishFamily,
            'cuisine' => $identity->cuisine,
            'category' => $identity->category,
            'form' => $identity->form,
            'title' => (string) $recipe->title,
            'fingerprint' => $fingerprint?->fingerprint, // string|null
            'identity' => $identity->toArray(),
            'text_version' => EmbeddingTextBuilder::TEXT_VERSION,
            'model' => $model,
        ];
    }

    /**
     * The recipe equivalent of a null identity: no title AND zero
     * ingredients AND zero steps — nothing the extractor could ever use.
     */
    private static function recipeCarriesNoIdentity(Recipe $recipe): bool
    {
        return trim((string) $recipe->title) === ''
            && self::strings($recipe->ingredients) === []
            && self::strings($recipe->steps) === [];
    }

    /**
     * @return list<string>
     */
    private static function strings(mixed $value): array
    {
        return is_array($value) ? array_values(array_map('strval', $value)) : [];
    }

    /**
     * Record failure. $attemptDelta is 1 only when a provider round was
     * actually burned for this row (attempts counts provider attempts);
     * identity-less failures leave the counter alone.
     */
    private function recordFailed(int $recipeId, string $error, int $attemptDelta): void
    {
        $existing = RecipeEmbedding::query()->where('recipe_id', $recipeId)->first();

        RecipeEmbedding::updateOrCreate(['recipe_id' => $recipeId], [
            'status' => RecipeEmbedding::STATUS_FAILED,
            'last_error' => mb_substr(trim($error), 0, 2000),
            'attempts' => ($existing?->attempts ?? 0) + $attemptDelta,
        ]);
    }

    /**
     * Record success: status/model/dimensions/hash stay authoritative for
     * the cheap skip in run(); attempts reflects the burned provider call.
     *
     * @param  array{recipe_id: int, text_hash: string, model: string}  $row
     */
    private function recordIndexed(array $row, int $dimensions): void
    {
        $existing = RecipeEmbedding::query()->where('recipe_id', $row['recipe_id'])->first();

        RecipeEmbedding::updateOrCreate(['recipe_id' => $row['recipe_id']], [
            'status' => RecipeEmbedding::STATUS_INDEXED,
            'model' => $row['model'],
            'dimensions' => $dimensions,
            'text_hash' => $row['text_hash'],
            'attempts' => ($existing?->attempts ?? 0) + 1,
            'last_error' => null,
            'indexed_at' => now(),
        ]);
    }
}
