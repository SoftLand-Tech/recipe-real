<?php

namespace App\Services\RecipeImport;

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
        $terms = HalalGate::scan([
            $data['title'] ?? null,
            $data['title_ar'] ?? null,
            $data['description'] ?? null,
            $data['ingredients'] ?? [],
            array_column($data['steps'] ?? [], 'description'),
            array_column($data['steps'] ?? [], 'description_ar'),
        ]);

        if ($terms !== []) {
            throw new RecipeContentRejected($terms);
        }

        return DB::transaction(function () use ($owner, $data, $import, $publishedBy): Recipe {
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

            $steps = array_values($data['steps'] ?? []);
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
                'title' => $data['title'],
                'source_url' => array_key_exists('source_url', $data)
                    ? $data['source_url']
                    : $lockedImport?->source_url,
                'title_ar' => $data['title_ar'] ?? null,
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
