<?php

namespace App\Services\RecipeImport;

class RecipeDraftMapper
{
    /**
     * Convert the normalized draft to the existing user-recipe write shape.
     *
     * @param  array<string, mixed>  $draft
     * @return array<string, mixed>
     */
    public function toPublishInput(array $draft): array
    {
        $ingredients = [];
        $structured = [];

        foreach (is_array($draft['ingredients'] ?? null) ? $draft['ingredients'] : [] as $ingredient) {
            if (is_string($ingredient)) {
                $raw = trim($ingredient);
                $structured[] = ['raw' => $raw];
                $rawAr = null;
            } elseif (is_array($ingredient)) {
                $raw = trim((string) ($ingredient['raw'] ?? $ingredient['text'] ?? $ingredient['name'] ?? ''));
                $structured[] = $ingredient;
                $rawAr = trim((string) ($ingredient['raw_ar'] ?? $ingredient['item_ar'] ?? ''));
                $rawAr = $rawAr === '' ? null : $rawAr;
            } else {
                continue;
            }

            if ($raw !== '') {
                $ingredients[] = $raw;
                $ingredientsAr[] = $rawAr;
            }
        }

        // Prefer per-item Arabic (raw_ar/item_ar) when every line has one;
        // otherwise fall back to a draft-level ingredients_ar array.
        $ingredientsAr = isset($ingredientsAr)
            && count($ingredientsAr) === count($ingredients)
            && ! in_array(null, $ingredientsAr, true)
            ? array_values($ingredientsAr)
            : (is_array($draft['ingredients_ar'] ?? null) ? array_values($draft['ingredients_ar']) : null);

        $steps = [];
        foreach (is_array($draft['steps'] ?? null) ? $draft['steps'] : [] as $step) {
            if (is_string($step)) {
                $description = trim($step);
                $step = [];
            } elseif (is_array($step)) {
                $description = trim((string) ($step['description'] ?? $step['text'] ?? ''));
            } else {
                continue;
            }

            if ($description === '') {
                continue;
            }

            $steps[] = [
                'description' => $description,
                'description_ar' => $step['description_ar'] ?? null,
                'minutes_estimated' => $step['minutes_estimated'] ?? $step['minutes'] ?? null,
                'literal_minutes' => $step['literal_minutes'] ?? null,
                'step_type' => $step['step_type'] ?? 'active',
            ];
        }

        return array_filter([
            'title' => $draft['title'] ?? null,
            'title_ar' => $draft['title_ar'] ?? null,
            'description' => $draft['description'] ?? null,
            'source_url' => data_get($draft, 'attribution.source_url'),
            'image_url' => $draft['cover_image_url'] ?? null,
            'servings' => $draft['servings'] ?? null,
            'estimated_minutes' => $draft['total_time_minutes'] ?? null,
            'prep_time_minutes' => $draft['prep_time_minutes'] ?? null,
            'cook_time_minutes' => $draft['cook_time_minutes'] ?? null,
            'ingredients' => $ingredients,
            'ingredients_ar' => $ingredientsAr,
            'ingredients_structured' => ['v' => 1, 'items' => array_values($structured)],
            'steps' => $steps,
            'category' => $draft['category'] ?? null,
            'keywords' => $draft['keywords'] ?? [],
            'calories' => data_get($draft, 'nutrition.calories'),
            'protein_g' => data_get($draft, 'nutrition.protein_g'),
            'fat_g' => data_get($draft, 'nutrition.fat_g'),
        ], static fn (mixed $value): bool => $value !== null);
    }
}
