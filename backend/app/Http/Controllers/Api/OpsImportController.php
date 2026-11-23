<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\IndexRecipe;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Support\CommunityFeedCache;
use App\Support\HalalGate;
use App\Support\RecipeFtsIndex;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Ops machine endpoint for the local dedup workbench: pushes human-curated
 * own-dataset recipes into production (source_type='official').
 *
 * Auth: static bearer token (config('recipeops.import_token')) — no sanctum
 * user; this is a machine client. Idempotent per recipes.external_id: a
 * re-run of a failed sync returns the existing recipe (status 'existing').
 *
 * Trust model (per Mamoun's rollout decision): the workbench IS the curation
 * gate — no duplicate DETECTION here. The halal gate still applies locally
 * (audience rule, cheap regex) and the recipe is indexed into the dedup
 * engine (fingerprint + embeddings) flag-only, so the engine's records stay
 * complete without gating the insert.
 */
class OpsImportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $this->assertToken($request);

        $data = $request->validate([
            'batch_name' => ['required', 'string', 'max:100'],
            'recipes' => ['required', 'array', 'max:100'],
            'recipes.*.external_id' => ['required', 'string', 'max:150'],
            'recipes.*.title' => ['required', 'string', 'max:255'],
            'recipes.*.title_ar' => ['nullable', 'string', 'max:255'],
            'recipes.*.description' => ['nullable', 'string', 'max:2000'],
            'recipes.*.category' => ['nullable', 'string', 'max:100'],
            'recipes.*.cuisine' => ['nullable', 'string', 'max:60'],
            'recipes.*.tags' => ['nullable', 'array'],
            'recipes.*.tags.*' => ['string', 'max:60'],
            'recipes.*.ingredients' => ['required', 'array', 'min:1', 'max:60'],
            'recipes.*.ingredients.*' => ['required', 'string', 'max:300'],
            'recipes.*.ingredients_ar' => ['nullable', 'array', 'max:60'],
            'recipes.*.ingredients_ar.*' => ['required', 'string', 'max:300'],
            'recipes.*.ingredients_structured' => ['nullable', 'array'],
            'recipes.*.ingredients_structured.v' => ['nullable', 'integer', 'in:1'],
            'recipes.*.ingredients_structured.items' => ['nullable', 'array', 'max:60'],
            'recipes.*.steps' => ['required', 'array', 'min:1', 'max:40'],
            'recipes.*.steps.*.en' => ['required', 'string', 'max:2000'],
            'recipes.*.steps.*.ar' => ['nullable', 'string', 'max:2000'],
            'recipes.*.steps.*.minutes' => ['nullable', 'integer', 'min:0', 'max:600'],
            'recipes.*.steps.*.type' => ['nullable', 'in:active,passive,cleanup'],
            'recipes.*.steps.*.literal' => ['nullable', 'integer', 'min:0', 'max:600'],
            'recipes.*.source_url' => ['nullable', 'url', 'max:255'],
            'recipes.*.image_query' => ['nullable', 'string', 'max:120'],
        ]);

        $results = [];
        $created = 0;
        $existing = 0;
        $rejected = 0;

        foreach ($data['recipes'] as $recipe) {
            try {
                $existingRow = Recipe::query()
                    ->where('external_id', $recipe['external_id'])
                    ->first();

                if ($existingRow !== null) {
                    $existing++;
                    $results[] = [
                        'external_id' => $recipe['external_id'],
                        'recipe_id' => (int) $existingRow->id,
                        'status' => 'existing',
                    ];

                    continue;
                }

                $steps = $this->normalizeSteps($recipe['steps'] ?? []);

                $terms = HalalGate::scan([
                    $recipe['title'],
                    $recipe['title_ar'] ?? null,
                    $recipe['description'] ?? null,
                    $recipe['ingredients'],
                    array_column($steps, 'en'),
                ]);
                if ($terms !== []) {
                    $rejected++;
                    $results[] = [
                        'external_id' => $recipe['external_id'],
                        'recipe_id' => null,
                        'status' => 'rejected',
                        'detail' => 'halal_content: '.implode(', ', $terms),
                    ];

                    continue;
                }

                $recipeId = $this->insertRecipe($data['batch_name'], $recipe, $steps);
                $created++;
                $results[] = [
                    'external_id' => $recipe['external_id'],
                    'recipe_id' => $recipeId,
                    'status' => 'created',
                ];
            } catch (Throwable $error) {
                $rejected++;
                Log::warning('ops import: recipe failed', [
                    'external_id' => $recipe['external_id'] ?? null,
                    'error' => $error->getMessage(),
                ]);
                $results[] = [
                    'external_id' => $recipe['external_id'] ?? null,
                    'recipe_id' => null,
                    'status' => 'rejected',
                    'detail' => mb_substr($error->getMessage(), 0, 300),
                ];
            }
        }

        return response()->json([
            'created' => $created,
            'existing' => $existing,
            'rejected' => $rejected,
            'results' => $results,
        ], $rejected === 0 ? 201 : 200);
    }

    /**
     * Insert one recipe mirroring UserRecipeController@store: recipe row +
     * recipe_steps + FTS row, then best-effort search sync, cache busts and
     * dedup-engine indexing (flag-only).
     */
    private function insertRecipe(string $batchName, array $recipe, array $steps): int
    {
        $ingredientsAr = array_values(array_map(
            fn ($line): string => (string) $line,
            $recipe['ingredients_ar'] ?? [],
        ));
        $ingredientsCount = count($recipe['ingredients']);
        if ($ingredientsAr !== [] && count($ingredientsAr) !== $ingredientsCount) {
            throw new \InvalidArgumentException('ingredients_ar must mirror ingredients line-for-line.');
        }

        $publisherMinutes = array_sum(array_map(
            fn (array $step): int => (int) ($step['minutes'] ?? 0),
            $steps,
        ));

        [$recipeId] = DB::transaction(function () use ($recipe, $steps, $ingredientsAr, $publisherMinutes): array {
            $new = Recipe::create([
                'external_id' => $recipe['external_id'],
                'source_type' => 'official',
                'title' => $recipe['title'],
                'title_ar' => filled($recipe['title_ar'] ?? null) ? trim((string) $recipe['title_ar']) : null,
                'description' => $recipe['description'] ?? null,
                'ingredients' => array_values($recipe['ingredients']),
                'ingredients_ar' => $ingredientsAr !== [] ? json_encode($ingredientsAr, JSON_UNESCAPED_UNICODE) : null,
                'steps' => array_column($steps, 'en'),
                'steps_ar' => $this->stepsArJson($steps),
                'steps_count' => count($steps),
                'category' => $recipe['category'] ?? null,
                'keywords' => array_values($recipe['tags'] ?? []),
                'servings' => $recipe['servings'] ?? null,
                'publisher_time_minutes' => $publisherMinutes > 0 ? $publisherMinutes : null,
                'source_url' => $recipe['source_url'] ?? null,
            ]);

            if (isset($recipe['cuisine']) && filled($recipe['cuisine'])) {
                // Cuisine rides on keywords for the engine's detector hints.
                $new->keywords = array_values(array_unique([
                    trim((string) $recipe['cuisine']),
                    ...array_values($recipe['tags'] ?? []),
                ]));
                $new->save();
            }

            if (isset($recipe['ingredients_structured']) && is_array($recipe['ingredients_structured'])) {
                $new->ingredients_structured = $recipe['ingredients_structured'];
                $new->save();
            }

            foreach ($steps as $index => $step) {
                RecipeStep::query()->create([
                    'recipe_id' => $new->id,
                    'step_number' => $index + 1,
                    'description' => $step['en'],
                    'description_ar' => $step['ar'] ?? null,
                    'step_type' => $step['type'] ?? 'active',
                    'ai_minutes' => $step['minutes'] ?? null,
                    'literal_minutes' => $step['literal'] ?? null,
                ]);
            }

            $raw = $new->getAttributes();
            DB::table('recipes_fts')->insert(RecipeFtsIndex::row(
                id: (int) $new->id,
                title: (string) $new->title,
                titleAr: isset($raw['title_ar']) ? (string) $raw['title_ar'] : null,
                ingredientsRaw: isset($raw['ingredients']) ? (string) $raw['ingredients'] : null,
                ingredientsArRaw: isset($raw['ingredients_ar']) ? (string) $raw['ingredients_ar'] : null,
                description: isset($raw['description']) ? (string) $raw['description'] : null,
            ));

            return [(int) $new->id, $new];
        });

        $fresh = Recipe::query()->with('recipeSteps')->find($recipeId);
        if ($fresh === null) {
            return $recipeId;
        }

        $this->syncSearch($fresh);
        ShareCache::forgetRecipe($recipeId);
        CommunityFeedCache::bumpTiming();

        if ((bool) config('recipe_dedup.indexing.enabled', false)) {
            try {
                IndexRecipe::dispatch($recipeId);
            } catch (Throwable $error) {
                Log::warning('ops import: dedup indexing dispatch failed', [
                    'recipe_id' => $recipeId,
                    'error' => $error->getMessage(),
                ]);
            }
        }

        return $recipeId;
    }

    /**
     * @param  list<array{en: string, ar?: ?string, minutes?: ?int, type?: ?string, literal?: ?int}>  $steps
     * @return list<array{en: string, ar?: ?string, minutes?: ?int, type?: ?string, literal?: ?int}>
     */
    private function normalizeSteps(array $steps): array
    {
        return array_map(static fn (array $step): array => [
            'en' => trim((string) $step['en']),
            'ar' => filled($step['ar'] ?? null) ? trim((string) $step['ar']) : null,
            'minutes' => $step['minutes'] ?? null,
            'type' => $step['type'] ?? 'active',
            'literal' => $step['literal'] ?? null,
        ], array_values($steps));
    }

    /**
     * @param  list<array{ar?: ?string}>  $steps
     */
    private function stepsArJson(array $steps): ?string
    {
        $arabic = array_map(static fn (array $step) => $step['ar'] ?? null, $steps);

        if (array_filter($arabic, fn ($line) => $line !== null && $line !== '') === []) {
            return null;
        }

        return json_encode($arabic, JSON_UNESCAPED_UNICODE);
    }

    private function syncSearch(Recipe $recipe): void
    {
        try {
            $typesense = app(TypesenseSearch::class);
            if (! $typesense->enabled()) {
                return;
            }
            $typesense->upsertDocs([$typesense->documentFor($recipe)]);
        } catch (Throwable $error) {
            Log::warning('ops import: typesense sync failed', [
                'recipe_id' => $recipe->id,
                'error' => $error->getMessage(),
            ]);
        }
    }

    private function assertToken(Request $request): void
    {
        $expected = (string) config('recipeops.import_token', '');

        if ($expected === '' || ! hash_equals($expected, (string) $request->bearerToken())) {
            abort(401, 'Unauthorized ops import.');
        }
    }
}
