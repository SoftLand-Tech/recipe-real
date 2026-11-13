<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRecipeRequest;
use App\Http\Requests\UpdateUserRecipeRequest;
use App\Http\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex as RebuildSearchIndexJob;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Support\CommunityFeedCache;
use App\Support\HalalGate;
use App\Support\RecipeFtsIndex;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * User-created recipes (community platform): create, edit and delete your
 * own recipes (source_type='user', owner_id = you) plus the "my recipes"
 * listing. Imported Food.com rows have owner_id null, so the ownership
 * check alone keeps them out of these write paths.
 */
class UserRecipeController extends Controller
{
    /**
     * Create a user recipe: recipe row + recipe_steps rows + FTS row.
     */
    public function store(StoreUserRecipeRequest $request): JsonResponse
    {
        $data = $request->validated();
        [$title, $titleAr] = $this->normalizeTitle($data['title'] ?? null, $data['title_ar'] ?? null);
        $steps = $this->normalizeSteps($data['steps']);

        // HALAL GATE: reject pork/alcohol content before anything is
        // written, listing the offending terms.
        $this->assertHalal([
            $title,
            $titleAr,
            $data['description'] ?? null,
            $data['ingredients'],
            array_column($steps, 'description'),
            array_column($steps, 'description_ar'),
        ]);

        $recipe = DB::transaction(function () use ($request, $data, $title, $titleAr, $steps): Recipe {
            $recipe = Recipe::create([
                'owner_id' => $request->user()->id,
                'source_type' => 'user',
                'title' => $title,
                'source_url' => $data['source_url'] ?? null,
                'title_ar' => $titleAr,
                'description' => $data['description'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                // The user's own claim drives the publisher estimate; the
                // per-step minutes land on recipe_steps.ai_minutes.
                'publisher_time_minutes' => $data['estimated_minutes'],
                'servings' => $data['servings'] ?? null,
                'prep_time_minutes' => $data['prep_time_minutes'] ?? null,
                'cook_time_minutes' => $data['cook_time_minutes'] ?? null,
                'ingredients' => $data['ingredients'],
                'steps' => array_column($steps, 'description'),
                // Raw JSON strings, matching how the translate pipeline
                // stores the Arabic columns (no array cast on the model).
                'ingredients_ar' => isset($data['ingredients_ar'])
                    ? json_encode($data['ingredients_ar'])
                    : null,
                'steps_ar' => $this->stepsArJson($steps),
                'steps_count' => count($steps),
            ]);

            if (array_key_exists('ingredients_structured', $data)) {
                $recipe->ingredients_structured = $data['ingredients_structured'];
                $recipe->save();
            }

            $this->replaceSteps($recipe, $steps);

            // Estimate-path reality: sum of non-cleanup ai_minutes.
            $recipe->recalculateReality();

            // FTS row, mirroring migration 000017's index-time format
            // EXACTLY (rowid = id, lower(title), raw JSON ingredients,
            // description; see RebuildSearchIndex command). A new rowid
            // makes a plain INSERT safe on the contentless table.
            $raw = $recipe->getAttributes();
            DB::table('recipes_fts')->insert(RecipeFtsIndex::row(
                id: (int) $recipe->id,
                title: (string) $recipe->title,
                titleAr: isset($raw['title_ar']) ? (string) $raw['title_ar'] : null,
                ingredientsRaw: isset($raw['ingredients']) ? (string) $raw['ingredients'] : null,
                ingredientsArRaw: isset($raw['ingredients_ar']) ? (string) $raw['ingredients_ar'] : null,
                description: isset($raw['description']) ? (string) $raw['description'] : null,
            ));

            return $recipe;
        });

        // Write-through search sync (best-effort): a Typesense outage or
        // timeout must never fail the request — log and move on. The
        // nightly recipereal:reindex-typesense heals any drift anyway.
        $this->syncSearch($recipe, 'upsert');

        // A new rowid can enter rails/leaderboards only via rating backfills
        // (user rows start unrated), but its share page may already be
        // primed by an early share — forget it.
        ShareCache::forgetRecipe($recipe->id);

        return (new RecipeResource($recipe->load('recipeSteps')))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update a user recipe (owner-only). Provided fields only; a `steps`
     * list replaces the old steps wholesale (delete + reinsert).
     */
    public function update(UpdateUserRecipeRequest $request, Recipe $recipe): RecipeResource
    {
        $this->assertOwner($request, $recipe);

        $data = $request->validated();
        $updatingTitle = array_key_exists('title', $data) || array_key_exists('title_ar', $data);
        [$resolvedTitle, $resolvedTitleAr] = $updatingTitle
            ? $this->normalizeTitle(
                array_key_exists('title', $data) ? $data['title'] : $recipe->title,
                array_key_exists('title_ar', $data) ? $data['title_ar'] : $recipe->title_ar,
            )
            : [$recipe->title, $recipe->title_ar];
        $steps = isset($data['steps']) ? $this->normalizeSteps($data['steps']) : null;

        // HALAL GATE on the resulting content: provided fields win, unset
        // fields fall back to the stored ones (the scan sees the final
        // state either way).
        $this->assertHalal([
            $resolvedTitle,
            $resolvedTitleAr,
            $data['description'] ?? $recipe->description,
            $data['ingredients'] ?? $recipe->ingredients,
            $steps !== null
                ? array_column($steps, 'description')
                : $recipe->recipeSteps->pluck('description')->all(),
            $steps !== null
                ? array_column($steps, 'description_ar')
                : $recipe->recipeSteps->pluck('description_ar')->all(),
        ]);

        DB::transaction(function () use ($data, $recipe, $updatingTitle, $resolvedTitle, $resolvedTitleAr, $steps): void {
            $recipe->fill(collect($data)->only([
                'description', 'image_url', 'source_url',
                'servings', 'prep_time_minutes', 'cook_time_minutes',
            ])->all());

            if ($updatingTitle) {
                $recipe->title = $resolvedTitle;
                $recipe->title_ar = $resolvedTitleAr;
            }

            if (array_key_exists('estimated_minutes', $data)) {
                $recipe->publisher_time_minutes = $data['estimated_minutes'];
            }

            if (array_key_exists('ingredients', $data)) {
                $recipe->ingredients = $data['ingredients'];
            }

            if (array_key_exists('ingredients_ar', $data)) {
                $recipe->ingredients_ar = isset($data['ingredients_ar'])
                    ? json_encode($data['ingredients_ar'])
                    : null;
            }

            if (array_key_exists('ingredients_structured', $data)) {
                $recipe->ingredients_structured = $data['ingredients_structured'];
            }

            if ($steps !== null) {
                $recipe->steps = array_column($steps, 'description');
                $recipe->steps_ar = $this->stepsArJson($steps);
                $recipe->steps_count = count($steps);

                $this->replaceSteps($recipe, $steps);
            }

            $recipe->save();

            // Per-step minutes may have changed → refresh the estimate.
            $recipe->recalculateReality();
        });

        // The contentless FTS row cannot be updated in place (no
        // contentless_delete on this table) — queue a full rebuild. On the
        // sync connection it runs immediately; on database/redis a worker
        // picks it up.
        RebuildSearchIndexJob::dispatch();

        $this->syncSearch($recipe->fresh(), 'upsert');

        // Title/photo/times render on /r/{id} and on every attached post's
        // card — forget both surfaces (per locale). Timing edits also move
        // the shared timing caches (rails/leaderboard carry these fields).
        ShareCache::forgetRecipe($recipe->id);
        CommunityFeedCache::bumpTiming();

        return new RecipeResource($recipe->fresh(['recipeSteps']));
    }

    /**
     * Delete a user recipe (owner-only). 204; the FTS row is cleaned up by
     * the queued rebuild.
     */
    public function destroy(Request $request, Recipe $recipe): JsonResponse
    {
        $this->assertOwner($request, $recipe);

        $recipeId = $recipe->id;
        // Capture BEFORE delete: the FK nulls posts.recipe_id on delete,
        // after which the attached posts can no longer be found this way.
        $attachedPostIds = Post::query()
            ->where('recipe_id', $recipeId)
            ->pluck('id')
            ->all();

        DB::transaction(function () use ($recipe): void {
            $recipe->delete(); // recipe_steps cascade via FK
        });

        RebuildSearchIndexJob::dispatch();

        $this->syncSearch($recipe, 'delete');

        // Surviving attached posts must drop the dead recipe card from
        // their /p pages; the deleted /r page 404s via route binding.
        ShareCache::forgetRecipe($recipeId);
        ShareCache::forgetPosts($attachedPostIds);
        CommunityFeedCache::bumpTiming();

        return response()->json(null, 204);
    }

    /**
     * The authed user's own recipes, newest first, 12/page, light rows.
     */
    public function mine(Request $request): AnonymousResourceCollection
    {
        $recipes = Recipe::query()
            ->where('owner_id', $request->user()->id)
            ->select([
                'id', 'title', 'title_ar', 'image_url', 'description',
                'publisher_time_minutes', 'reality_minutes', 'reality_source',
                'steps_count', 'created_at', 'updated_at',
            ])
            ->latest('id')
            ->paginate(12);

        return RecipeResource::collection($recipes);
    }

    /**
     * Owner check: only the creating user may edit/delete (imported rows
     * have owner_id null and never pass).
     */
    private function assertOwner(Request $request, Recipe $recipe): void
    {
        if ($recipe->owner_id === null || $recipe->owner_id !== $request->user()->id) {
            abort(403, 'You do not own this recipe.');
        }
    }

    /**
     * Best-effort Typesense write-through sync for user-recipe writes:
     * upsert on create/update (fresh model → full doc incl. reality), a
     * delete on destroy. Disabled daemon = no-op; failure logs a warning
     * and never fails the request (nightly reindex heals drift).
     */
    private function syncSearch(?Recipe $recipe, string $op): void
    {
        try {
            $typesense = app(TypesenseSearch::class);

            if (! $typesense->enabled() || $recipe === null) {
                return;
            }

            if ($op === 'delete') {
                $typesense->deleteDoc((string) $recipe->id);

                return;
            }

            $typesense->upsertDocs([$typesense->documentFor($recipe)]);
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => $op,
                'recipe_id' => $recipe?->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Halal gate: 422 with the offending terms (see HalalGate for the
     * canonical pork + alcohol regexes).
     *
     * @param  list<string|array<string>|null>  $texts
     */
    private function assertHalal(array $texts): void
    {
        $terms = HalalGate::scan($texts);

        if ($terms !== []) {
            throw new HttpResponseException(response()->json([
                'message' => 'This recipe contains haram ingredients or alcohol references, which are not allowed.',
                'terms' => $terms,
            ], 422));
        }
    }

    /**
     * Ensure `title` (NOT NULL in DB) falls back to `title_ar` when only
     * Arabic is given, while preserving `title_ar` as null when blank.
     *
     * @return array{0: string, 1: ?string}
     */
    private function normalizeTitle(?string $title, ?string $titleAr): array
    {
        $cleanTitleAr = filled($titleAr) ? trim((string) $titleAr) : null;
        $cleanTitle = filled($title) ? trim((string) $title) : ($cleanTitleAr ?? '');

        return [$cleanTitle, $cleanTitleAr];
    }

    /**
     * Normalize each step so `description` (NOT NULL in DB) falls back to
     * `description_ar` when English is omitted, preserving `description_ar`.
     *
     * @param  list<array<string, mixed>>  $steps
     * @return list<array<string, mixed>>
     */
    private function normalizeSteps(array $steps): array
    {
        return array_map(function (array $step): array {
            $descAr = filled($step['description_ar'] ?? null)
                ? trim((string) $step['description_ar'])
                : null;
            $desc = filled($step['description'] ?? null)
                ? trim((string) $step['description'])
                : ($descAr ?? '');

            return [
                ...$step,
                'description' => $desc,
                'description_ar' => $descAr,
            ];
        }, array_values($steps));
    }

    /**
     * Build the raw steps_ar JSON string from the request's steps array
     * (null when no step carries an Arabic description).
     *
     * @param  list<array<string, mixed>>  $steps
     */
    private function stepsArJson(array $steps): ?string
    {
        $arabic = array_map(
            fn (array $step) => $step['description_ar'] ?? null,
            $steps
        );

        if (array_filter($arabic, fn ($line) => $line !== null && $line !== '') === []) {
            return null;
        }

        return json_encode($arabic);
    }

    /**
     * Rewrite the recipe's recipe_steps rows (delete + reinsert) with the
     * request's step payload: sequence number, optional Arabic line, type
     * (default active) and the per-step estimate on ai_minutes (the column
     * the estimate-path reality sum reads).
     *
     * @param  list<array<string, mixed>>  $steps
     */
    private function replaceSteps(Recipe $recipe, array $steps): void
    {
        RecipeStep::where('recipe_id', $recipe->id)->delete();

        foreach ($steps as $index => $step) {
            $recipe->recipeSteps()->create([
                'step_number' => $index + 1,
                'description' => $step['description'],
                'description_ar' => $step['description_ar'] ?? null,
                'step_type' => $step['step_type'] ?? 'active',
                'ai_minutes' => $step['minutes_estimated'] ?? null,
                'literal_minutes' => $step['literal_minutes'] ?? null,
            ]);
        }
    }
}
