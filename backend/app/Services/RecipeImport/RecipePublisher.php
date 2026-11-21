<?php

namespace App\Services\RecipeImport;

use App\Jobs\IndexRecipe;
use App\Models\Recipe;
use App\Models\RecipeImport;
use App\Models\RecipeStep;
use App\Models\User;
use App\Support\HalalGate;
use App\Support\RecipeFtsIndex;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class RecipePublisher
{
    /**
     * Publish a reviewed user/imported draft into the existing recipe schema.
     *
     * @param  array<string, mixed>  $data
     */
    public function publish(
        User $owner,
        array $data,
        ?RecipeImport $import = null,
        ?User $publishedBy = null,
    ): Recipe {
        [$title, $titleAr] = $this->normalizeTitle($data['title'] ?? null, $data['title_ar'] ?? null);
        $steps = $this->normalizeSteps($data['steps'] ?? []);

        $terms = HalalGate::scan([
            $title,
            $titleAr,
            $data['description'] ?? null,
            $data['ingredients'] ?? [],
            array_column($steps, 'description'),
            array_column($steps, 'description_ar'),
        ]);

        if ($terms !== []) {
            throw new RecipeContentRejected($terms);
        }

        $recipe = DB::transaction(function () use ($owner, $data, $import, $publishedBy, $title, $titleAr, $steps): Recipe {
            $lockedImport = $import === null
                ? null
                : RecipeImport::query()->lockForUpdate()->findOrFail($import->id);

            if ($lockedImport?->status === 'published' && $lockedImport->recipe_id !== null) {
                return $lockedImport->recipe()->with('recipeSteps')->firstOrFail();
            }
            if ($lockedImport !== null && $lockedImport->status !== 'ready') {
                throw new RecipeImportException(
                    'This import is not ready for review.',
                    'import_not_ready',
                );
            }

            $ingredients = array_values($data['ingredients'] ?? []);
            $imageUrl = array_key_exists('image_url', $data)
                ? $data['image_url']
                : data_get($lockedImport?->draft, 'cover_image_url');
            if (is_string($imageUrl) && trim($imageUrl) !== '') {
                try {
                    app(PublicUrlGuard::class)->assertPublic($imageUrl);
                } catch (Throwable) {
                    $imageUrl = null;
                }
            }

            $recipe = Recipe::create([
                'owner_id' => $owner->id,
                'source_type' => 'user',
                'title' => $title,
                'source_url' => array_key_exists('source_url', $data)
                    ? $data['source_url']
                    : $lockedImport?->source_url,
                'title_ar' => $titleAr,
                'description' => $data['description'] ?? null,
                'image_url' => $imageUrl,
                'publisher_time_minutes' => $data['estimated_minutes'],
                'servings' => $data['servings'] ?? null,
                'prep_time_minutes' => $data['prep_time_minutes'] ?? null,
                'cook_time_minutes' => $data['cook_time_minutes'] ?? null,
                'ingredients' => $ingredients,
                'steps' => array_column($steps, 'description'),
                'ingredients_ar' => ! empty($data['ingredients_ar'])
                    ? json_encode(array_values($data['ingredients_ar']), JSON_UNESCAPED_UNICODE)
                    : null,
                'steps_ar' => $this->stepsArJson($steps),
                'steps_count' => count($steps),
                'category' => $data['category'] ?? null,
                'keywords' => $data['keywords'] ?? [],
                'calories' => $data['calories'] ?? null,
                'protein_g' => $data['protein_g'] ?? null,
                'fat_g' => $data['fat_g'] ?? null,
            ]);

            if (array_key_exists('ingredients_structured', $data)) {
                $recipe->ingredients_structured = $data['ingredients_structured'];
                $recipe->save();
            }

            $this->replaceSteps($recipe, $steps);
            $recipe->recalculateReality();

            if (Schema::hasTable('recipes_fts')) {
                $raw = $recipe->getAttributes();
                DB::table('recipes_fts')->insert(RecipeFtsIndex::row(
                    id: (int) $recipe->id,
                    title: (string) $recipe->title,
                    titleAr: isset($raw['title_ar']) ? (string) $raw['title_ar'] : null,
                    ingredientsRaw: isset($raw['ingredients']) ? (string) $raw['ingredients'] : null,
                    ingredientsArRaw: isset($raw['ingredients_ar']) ? (string) $raw['ingredients_ar'] : null,
                    description: isset($raw['description']) ? (string) $raw['description'] : null,
                ));
            }

            if ($lockedImport !== null) {
                $lockedImport->update([
                    'status' => 'published',
                    'stage' => 'published',
                    'progress' => 100,
                    'recipe_id' => $recipe->id,
                    'published_by' => ($publishedBy ?: $owner)->id,
                    'expires_at' => now()->addDay(),
                ]);
            }

            return $recipe;
        });

        // Dedup indexing hook (recipe-dedup slice 6, docs/recipe-dedup.md):
        // the transaction has committed, so the async IndexRecipe job (when
        // the queue connection runs it) always sees a stored row. Gated by
        // DEDUP_INDEXING_ENABLED; an unchanged recipe is never re-embedded.
        if ((bool) config('recipe_dedup.indexing.enabled')) {
            IndexRecipe::dispatch((int) $recipe->getKey());
        }

        return $recipe;
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

    /** @param list<array<string, mixed>> $steps */
    private function stepsArJson(array $steps): ?string
    {
        $arabic = array_map(fn (array $step): ?string => $step['description_ar'] ?? null, $steps);

        return array_filter($arabic, fn (?string $line): bool => $line !== null && $line !== '') !== []
            ? json_encode($arabic, JSON_UNESCAPED_UNICODE)
            : null;
    }

    /** @param list<array<string, mixed>> $steps */
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
