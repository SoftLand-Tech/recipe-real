<?php

namespace App\Services\RecipeDedup\Detection;

use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\FingerprintSet;
use App\Services\RecipeDedup\Embeddings\EmbeddingTextBuilder;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Layer-2 candidate sourcing. Cheap and indexed ONLY — this class must
 * never scan the recipes table and never issue an unindexed WHERE. Every
 * source hits an index column:
 *
 *  A exact_fingerprint    recipe_fingerprints.fingerprint (UNIQUE — at
 *                         most one hit; only is_complete = true rows: a
 *                         degraded fingerprint must never auto-reject)
 *  B identity_signature   indexed; capped at retrieval.signature_candidates
 *  C main_ingredient_hash indexed; same cap
 *  D title_signature      indexed; same cap, lowest priority
 *  E vector               top-K cosine search in the vector store (only
 *                         when retrieval + store + embeddings are enabled
 *                         and the identity is embeddable), equality
 *                         filtered by dish_family/cuisine when known
 *                         AND retrieval.use_filters.
 *
 * Priority when a recipe is hit by several sources (kept for its
 * retrieval_source meta + the deterministic union order):
 *
 *     exact_fingerprint > identity_signature > vector (score desc)
 *                        > main_ingredient_hash > title_signature
 *
 * The union is deduped by recipe id and capped deterministically at
 * retrieval.max_candidates by walking sources in priority order.
 * The vector store returns RAW cosine similarity — this class applies
 * ONLY the retrieval.min_vector_score cutoff (to keep its list cheap);
 * every decision threshold stays in layer 2. All semantic failures are
 * FAIL-SOFT: logged, source E skipped, the structured sources still run.
 */
final class CandidateRetriever
{
    /** Retrieval source priority, lower wins. */
    private const SOURCE_PRIORITY = [
        'exact_fingerprint' => 1,
        'identity_signature' => 2,
        'vector' => 3,
        'main_ingredient_hash' => 4,
        'title_signature' => 5,
    ];

    public function __construct(
        private readonly FingerprintService $fingerprints,
        private readonly EmbeddingProvider $provider,
        private readonly VectorStore $store,
    ) {}

    /**
     * @param  Recipe|null  $exclude  skip one recipe (the candidate's own row
     *                                when re-evaluating an existing recipe)
     */
    public function retrieve(
        CandidateRecipe $candidate,
        CulinaryIdentity $identity,
        FingerprintSet $set,
        ?Recipe $exclude = null,
    ): CandidateRetrieval {
        $excludeId = $exclude?->id;

        // ---- Sources A-D: indexed hash lookups.
        $hits = [
            'exact_fingerprint' => $this->hashIds('fingerprint', $set->fingerprint, requireComplete: true, excludeId: $excludeId),
            'identity_signature' => $this->hashIds('identity_signature', $set->identitySignature, cap: $this->signatureCap(), excludeId: $excludeId),
            'main_ingredient_hash' => $this->hashIds('main_ingredient_hash', $set->mainIngredientHash, cap: $this->signatureCap(), excludeId: $excludeId),
            'title_signature' => $this->hashIds('title_signature', $set->titleSignature, cap: $this->signatureCap(), excludeId: $excludeId),
        ];

        // ---- Source E: semantic search (fail-soft).
        [$vector, $vectorHits] = $this->searchVectors($identity, $excludeId);
        $hits['vector'] = array_map(fn (array $hit): int => $hit['recipe_id'], $vectorHits);

        $vectorScores = [];
        foreach ($vectorHits as $hit) {
            $vectorScores[$hit['recipe_id']] = $hit['score'];
        }

        // ---- Deterministic union: sources in priority order, dedupe by
        //      recipe id (first source keeps the retrieval_source), capped.
        $cap = max(1, (int) config('recipe_dedup.retrieval.max_candidates', 40));
        $picked = []; // recipe_id => {source: string, vector_score: ?float}

        foreach (array_keys(self::SOURCE_PRIORITY) as $source) {
            foreach ($hits[$source] ?? [] as $recipeId) {
                if (array_key_exists($recipeId, $picked)) {
                    continue;
                }

                $picked[$recipeId] = [
                    'source' => $source,
                    'vector_score' => $source === 'vector' ? $vectorScores[$recipeId] : null,
                ];

                if (count($picked) >= $cap) {
                    break 2;
                }
            }
        }

        $sourceCounts = array_map(fn (array $ids): int => count($ids), $hits);

        if ($picked === []) {
            return new CandidateRetrieval(candidates: [], identities: [], vector: $vector, sources: $sourceCounts);
        }

        // ---- ONE recipes fetch + ONE fingerprint-rows fetch for the
        //      whole union; identity payloads join from memory.
        $recipeIds = array_keys($picked);
        $recipes = Recipe::query()->whereIn('id', $recipeIds)->get()->keyBy('id');
        $fingerprintRows = RecipeFingerprint::query()->whereIn('recipe_id', $recipeIds)->get()->keyBy('recipe_id');

        $candidates = [];
        $identities = [];

        foreach ($recipeIds as $recipeId) {
            $recipe = $recipes->get($recipeId);

            if ($recipe === null) {
                continue; // stale row without its recipe — cannot be scored
            }

            /** @var RecipeFingerprint|null $row */
            $row = $fingerprintRows->get($recipeId);
            $candidateIdentity = $row === null ? null : $this->fingerprints->deserializeIdentity($row->identity);

            if ($candidateIdentity === null) {
                // No parseable identity payload: scoring and the judge both
                // need one, so this candidate cannot take part in layer 2.
                continue;
            }

            $candidates[] = self::withRetrievalMeta(
                CandidateRecipe::fromRecipe($recipe),
                (string) $picked[$recipeId]['source'],
                $picked[$recipeId]['vector_score'],
            );

            $identities[] = [
                'id' => (int) $recipeId,
                'title' => (string) $recipe->title,
                'identity' => $candidateIdentity,
            ];
        }

        return new CandidateRetrieval(candidates: $candidates, identities: $identities, vector: $vector, sources: $sourceCounts);
    }

    /**
     * The identities for a set of recipes — the {id, title, identity}
     * rows the scorer + judge consume. ONE recipes fetch + ONE
     * recipe_fingerprints fetch; rows with a missing/unreadable identity
     * payload are skipped (never throws).
     *
     * @param  list<int>  $recipeIds
     * @return list<array{id:int, title:string, identity:CulinaryIdentity}>
     */
    public function identitiesForRecipes(array $recipeIds): array
    {
        $recipeIds = array_values(array_unique(array_map(intval(...), $recipeIds)));

        if ($recipeIds === []) {
            return [];
        }

        $rows = RecipeFingerprint::query()->whereIn('recipe_id', $recipeIds)->get()->keyBy('recipe_id');
        $titles = Recipe::query()->whereIn('id', $recipeIds)->pluck('title', 'id');

        $entries = [];

        foreach ($recipeIds as $recipeId) {
            /** @var RecipeFingerprint|null $row */
            $row = $rows->get($recipeId);

            if ($row === null || $titles->get($recipeId) === null) {
                continue;
            }

            $identity = $this->fingerprints->deserializeIdentity($row->identity);

            if ($identity === null) {
                continue;
            }

            $entries[] = [
                'id' => $recipeId,
                'title' => (string) $titles->get($recipeId),
                'identity' => $identity,
            ];
        }

        return $entries;
    }

    /**
     * One indexed hash lookup, capped and ordered for determinism.
     * $requireComplete applies ONLY to the exact fingerprint source.
     *
     * @return list<int>
     */
    private function hashIds(
        string $column,
        string $value,
        ?int $cap = null,
        bool $requireComplete = false,
        ?int $excludeId = null,
    ): array {
        if ($value === '') {
            return [];
        }

        return RecipeFingerprint::query()
            ->where($column, $value)
            ->when($requireComplete, fn ($query) => $query->where('is_complete', true))
            ->when($excludeId !== null, fn ($query) => $query->where('recipe_id', '!=', $excludeId))
            ->orderBy('recipe_id') // deterministic picks under any backend
            ->when($cap !== null, fn ($query) => $query->limit(max(1, $cap)))
            ->pluck('recipe_id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * The semantic source: ONE provider call for the candidate's identity
     * text, ONE store search, the min_vector_score cutoff applied HERE.
     * Any provider/store failure logs and SKIPS the source — never throws.
     *
     * @return array{0: list<float>|null, 1: list<array{recipe_id:int, score:float}>}
     */
    private function searchVectors(CulinaryIdentity $identity, ?int $excludeId): array
    {
        if (! $this->vectorEnabled($identity)) {
            // Retrieval off, store disabled (NullVectorStore), provider =
            // 'none', or nothing embeddable: the semantic source is absent.
            return [null, []];
        }

        $text = EmbeddingTextBuilder::build($identity);

        if (trim($text) === '') {
            return [null, []];
        }

        try {
            // ONE provider round trip — the vector of the CANDIDATE identity.
            $result = $this->provider->embed([$text]);
        } catch (Throwable $e) {
            Log::warning('recipe dedup: candidate embedding for retrieval failed — vector source skipped', [
                'error' => (string) $e->getMessage(),
            ]);

            return [null, []];
        }

        $vectors = array_values(is_array($result->vectors) ? $result->vectors : []);
        $vector = is_array($vectors[0] ?? null)
            ? array_map(floatval(...), $vectors[0])
            : null;

        if ($vector === null || $vector === []) {
            return [null, []];
        }

        try {
            $hits = $this->store->search(
                $vector,
                max(1, (int) config('recipe_dedup.retrieval.top_k', 24)),
                $this->searchFilters($identity),
            );
        } catch (Throwable $e) {
            Log::warning('recipe dedup: vector store search for retrieval failed — vector source skipped', [
                'error' => (string) $e->getMessage(),
            ]);

            return [$vector, []];
        }

        $minScore = (float) config('recipe_dedup.retrieval.min_vector_score', 0.55);

        $kept = array_values(array_filter(
            is_array($hits) ? $hits : [],
            fn (mixed $hit): bool => is_array($hit)
                && is_numeric($hit['score'] ?? null)
                && (float) $hit['score'] >= $minScore
                && ($excludeId === null || (int) ($hit['recipe_id'] ?? 0) !== $excludeId),
        ));

        usort($kept, fn (array $a, array $b): int => (float) $b['score'] <=> (float) $a['score']);

        return [
            $vector,
            array_map(fn (array $hit): array => [
                'recipe_id' => (int) $hit['recipe_id'],
                'score' => (float) $hit['score'],
            ], $kept),
        ];
    }

    private function signatureCap(): int
    {
        return max(1, (int) config('recipe_dedup.retrieval.signature_candidates', 24));
    }

    /**
     * The semantic source's preconditions: retrieval on, the RESOLVED
     * store enabled (NullVectorStore reports false), embeddings enabled,
     * the provider not the null 'none' one, and an embeddable identity.
     */
    private function vectorEnabled(CulinaryIdentity $identity): bool
    {
        return (bool) config('recipe_dedup.retrieval.enabled', false)
            && $this->store->enabled()
            && (bool) config('recipe_dedup.embeddings.enabled', true)
            && $this->provider->key() !== 'none'
            && trim(EmbeddingTextBuilder::build($identity)) !== '';
    }

    /**
     * Equality filters for the store search — dish_family / cuisine ONLY
     * when known AND use_filters is on (the point payload carries these
     * keys, see EmbeddingService::pointPayload()).
     *
     * @return array<string, string>
     */
    private function searchFilters(CulinaryIdentity $identity): array
    {
        if (! (bool) config('recipe_dedup.retrieval.use_filters', true)) {
            return [];
        }

        $filters = [];

        if (filled($identity->dishFamily)) {
            $filters['dish_family'] = (string) $identity->dishFamily;
        }

        if (filled($identity->cuisine)) {
            $filters['cuisine'] = (string) $identity->cuisine;
        }

        return $filters;
    }

    /**
     * The meta enrichment the brief requires on every returned candidate.
     * CandidateRecipe is frozen + readonly (and contract — not editable
     * here), so the enrichment REBUILDS the DTO with the merged $meta
     * instead of mutating a clone (readonly reinit is only legal inside
     * the declaring class' scope).
     */
    private static function withRetrievalMeta(CandidateRecipe $candidate, string $retrievalSource, ?float $vectorScore): CandidateRecipe
    {
        return new CandidateRecipe(
            title: $candidate->title,
            description: $candidate->description,
            ingredientsRaw: $candidate->ingredientsRaw,
            ingredientsStructured: $candidate->ingredientsStructured,
            steps: $candidate->steps,
            category: $candidate->category,
            cuisineHint: $candidate->cuisineHint,
            dishFamilyHint: $candidate->dishFamilyHint,
            keywords: $candidate->keywords,
            servings: $candidate->servings,
            prepTimeMinutes: $candidate->prepTimeMinutes,
            cookTimeMinutes: $candidate->cookTimeMinutes,
            totalTimeMinutes: $candidate->totalTimeMinutes,
            language: $candidate->language,
            meta: [
                ...$candidate->meta,
                'retrieval_source' => $retrievalSource,
                'vector_score' => $vectorScore,
            ],
        );
    }
}
