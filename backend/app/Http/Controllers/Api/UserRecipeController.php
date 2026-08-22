<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRecipeRequest;
use App\Http\Requests\UpdateUserRecipeRequest;
use App\Http\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex as RebuildSearchIndexJob;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Support\HalalGate;
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

        // HALAL GATE: reject pork/alcohol content before anything is
        // written, listing the offending terms.
        $this->assertHalal([
            $data['title'],
            $data['title_ar'] ?? null,
            $data['description'] ?? null,
            $data['ingredients'],
            array_column($data['steps'], 'description'),
            array_column($data['steps'], 'description_ar'),
        ]);

        $recipe = DB::transaction(function () use ($request, $data): Recipe {
            $steps = $data['steps'];

            $recipe = Recipe::create([
                'owner_id' => $request->user()->id,
                'source_type' => 'user',
                'title' => $data['title'],
                'title_ar' => $data['title_ar'] ?? null,
                'description' => $data['description'] ?? null,
                'image_url' => $data['image_url'] ?? null,
                // The user's own claim drives the publisher estimate; the
                // per-step minutes land on recipe_steps.ai_minutes.
                'publisher_time_minutes' => $data['estimated_minutes'],
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

            $this->replaceSteps($recipe, $steps);

            // Estimate-path reality: sum of non-cleanup ai_minutes.
            $recipe->recalculateReality();

            // FTS row, mirroring migration 000017's index-time format
            // EXACTLY (rowid = id, lower(title), raw JSON ingredients,
            // description; see RebuildSearchIndex command). A new rowid
            // makes a plain INSERT safe on the contentless table.
            $raw = $recipe->getAttributes();
            DB::table('recipes_fts')->insert([
                'rowid' => $recipe->id,
                'title' => strtolower((string) $recipe->title),
                'ingredients' => $raw['ingredients'] ?? '',
                'description' => $raw['description'] ?? '',
            ]);

            return $recipe;
        });

        // Write-through search sync (best-effort): a Typesense outage or
        // timeout must never fail the request — log and move on. The
        // nightly recipereal:reindex-typesense heals any drift anyway.
        $this->syncSearch($recipe, 'upsert');

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

        // HALAL GATE on the resulting content: provided fields win, unset
        // fields fall back to the stored ones (the scan sees the final
        // state either way).
        $this->assertHalal([
            $data['title'] ?? $recipe->title,
            $data['title_ar'] ?? $recipe->title_ar,
            $data['description'] ?? $recipe->description,
            $data['ingredients'] ?? $recipe->ingredients,
            isset($data['steps'])
                ? array_column($data['steps'], 'description')
                : $recipe->recipeSteps->pluck('description')->all(),
            isset($data['steps'])
                ? array_column($data['steps'], 'description_ar')
                : $recipe->recipeSteps->pluck('description_ar')->all(),
        ]);

        DB::transaction(function () use ($request, $data, $recipe): void {
            $recipe->fill(collect($data)->only([
                'title', 'title_ar', 'description', 'image_url',
            ])->all());

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

            if (isset($data['steps'])) {
                $steps = $data['steps'];
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

        return new RecipeResource($recipe->fresh(['recipeSteps']));
    }

    /**
     * Delete a user recipe (owner-only). 204; the FTS row is cleaned up by
     * the queued rebuild.
     */
    public function destroy(Request $request, Recipe $recipe): JsonResponse
    {
        $this->assertOwner($request, $recipe);

        DB::transaction(function () use ($recipe): void {
            $recipe->delete(); // recipe_steps cascade via FK
        });

        RebuildSearchIndexJob::dispatch();

        $this->syncSearch($recipe, 'delete');

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
            ]);
        }
    }
}
