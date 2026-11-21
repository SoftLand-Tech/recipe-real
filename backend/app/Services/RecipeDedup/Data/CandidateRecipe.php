<?php

namespace App\Services\RecipeDedup\Data;

use App\Models\Recipe;

/**
 * A recipe candidate entering the dedup engine: freshly generated or
 * existing. Pure data — no DB access.
 */
final class CandidateRecipe
{
    /**
     * @param  string  $title
     * @param  string|null  $description
     * @param  list<string>  $ingredientsRaw  raw ingredient lines ("1/4 cup brown sugar, packed")
     * @param  list<array{item:string,qty:float|null,unit:string|null,raw:string|null,prep:string|null}>  $ingredientsStructured
     * @param  list<string>  $steps
     * @param  string|null  $category
     * @param  string|null  $cuisineHint  explicit cuisine when the caller knows it (generation brief)
     * @param  string|null  $dishFamilyHint
     * @param  list<string>  $keywords
     * @param  int|null  $servings
     * @param  int|null  $prepTimeMinutes
     * @param  int|null  $cookTimeMinutes
     * @param  int|null  $totalTimeMinutes
     * @param  string  $language  "en" | "ar" (affects the embedding text builder)
     * @param  array<string, mixed>  $meta  extra caller context (e.g. generation batch brief)
     */
    public function __construct(
        public readonly string $title,
        public readonly ?string $description = null,
        public readonly array $ingredientsRaw = [],
        public readonly array $ingredientsStructured = [],
        public readonly array $steps = [],
        public readonly ?string $category = null,
        public readonly ?string $cuisineHint = null,
        public readonly ?string $dishFamilyHint = null,
        public readonly array $keywords = [],
        public readonly ?int $servings = null,
        public readonly ?int $prepTimeMinutes = null,
        public readonly ?int $cookTimeMinutes = null,
        public readonly ?int $totalTimeMinutes = null,
        public readonly string $language = 'en',
        public readonly array $meta = [],
    ) {}

    /**
     * Build from an existing Recipe row (works with partial metadata:
     * missing ingredients/steps/description degrade to empty lists).
     */
    public static function fromRecipe(Recipe $recipe): self
    {
        $ingredients = $recipe->ingredients ?? [];
        if (! is_array($ingredients)) {
            $ingredients = [];
        }

        $steps = $recipe->steps ?? [];
        if (! is_array($steps)) {
            $steps = [];
        }

        $structured = $recipe->ingredients_structured ?? [];
        $structuredItems = self::structuredItems($structured);

        $keywords = $recipe->keywords ?? [];

        return new self(
            title: (string) $recipe->title,
            description: $recipe->description,
            ingredientsRaw: array_values(array_map(strval(...), array_values($ingredients))),
            ingredientsStructured: $structuredItems,
            steps: array_values(array_map(strval(...), array_values($steps))),
            category: $recipe->category,
            keywords: is_array($keywords) ? array_values(array_map(strval(...), $keywords)) : [],
            servings: $recipe->servings,
            prepTimeMinutes: $recipe->prep_time_minutes,
            cookTimeMinutes: $recipe->cook_time_minutes,
            language: filled($recipe->title_ar) || filled($recipe->ingredients_ar) ? 'en' : 'en',
            meta: [
                'source_type' => $recipe->source_type,
                'owner_id' => $recipe->owner_id,
            ],
        );
    }

    /**
     * Build from a generation draft (the shape the AI generator returns and
     * the same field names RecipeExtractionNormalizer produces).
     *
     * @param  array<string, mixed>  $draft
     */
    public static function fromDraft(array $draft): self
    {
        $ingredientsRaw = [];
        $structured = [];

        foreach ($draft['ingredients'] ?? [] as $ingredient) {
            if (is_string($ingredient)) {
                $ingredientsRaw[] = $ingredient;
                $structured[] = ['item' => '', 'qty' => null, 'unit' => null, 'raw' => $ingredient, 'prep' => null];

                continue;
            }

            if (is_array($ingredient)) {
                $raw = $ingredient['raw'] ?? $ingredient['raw_ar'] ?? $ingredient['item']
                    ?? $ingredient['name'] ?? null;
                if (is_string($raw) && $raw !== '') {
                    $ingredientsRaw[] = $raw;
                }

                $structured[] = [
                    'item' => is_string($ingredient['item'] ?? $ingredient['name'] ?? null)
                        ? trim((string) ($ingredient['item'] ?? $ingredient['name'])) : '',
                    'qty' => is_numeric($ingredient['quantity'] ?? $ingredient['qty'] ?? null)
                        ? (float) ($ingredient['quantity'] ?? $ingredient['qty']) : null,
                    'unit' => is_string($ingredient['unit'] ?? null) ? $ingredient['unit'] : null,
                    'raw' => is_string($raw) ? $raw : null,
                    'prep' => is_string($ingredient['prep'] ?? null) ? $ingredient['prep'] : null,
                ];
            }
        }

        $steps = array_values(array_filter(
            array_map(
                fn (mixed $step): ?string => is_string($step) ? $step
                    : (is_array($step) && is_string($step['description'] ?? null) ? $step['description'] : null),
                is_array($draft['steps'] ?? null) ? $draft['steps'] : [],
            ),
            fn (?string $step): bool => $step !== null,
        ));

        return new self(
            title: trim((string) ($draft['title'] ?? '')),
            description: is_string($draft['description'] ?? null) ? trim((string) $draft['description']) : null,
            ingredientsRaw: $ingredientsRaw,
            ingredientsStructured: $structured,
            steps: $steps,
            category: is_string($draft['category'] ?? null) ? $draft['category'] : null,
            cuisineHint: is_string($draft['cuisine'] ?? null) ? $draft['cuisine'] : null,
            dishFamilyHint: is_string($draft['dish_family'] ?? null) ? $draft['dish_family'] : null,
            keywords: array_values(array_filter(
                array_map(
                    strval(...),
                    is_array($draft['keywords'] ?? null) ? $draft['keywords'] : [],
                ),
                fn (string $keyword): bool => $keyword !== '',
            )),
            servings: is_numeric($draft['servings'] ?? null) ? (int) $draft['servings'] : null,
            prepTimeMinutes: is_numeric($draft['prep_time_minutes'] ?? null) ? (int) $draft['prep_time_minutes'] : null,
            cookTimeMinutes: is_numeric($draft['cook_time_minutes'] ?? null) ? (int) $draft['cook_time_minutes'] : null,
            totalTimeMinutes: is_numeric($draft['total_time_minutes'] ?? null) ? (int) $draft['total_time_minutes'] : null,
            language: (string) ($draft['language'] ?? 'en'),
            meta: is_array($draft['meta'] ?? null) ? $draft['meta'] : [],
        );
    }

    /**
     * The display snapshot kept on batch items — never full content.
     *
     * @return array<string, mixed>
     */
    public function compactSummary(): array
    {
        return [
            'title' => $this->title,
            'ingredients' => count($this->ingredientsRaw),
            'steps' => count($this->steps),
            'category' => $this->category,
            'cuisine' => $this->cuisineHint,
        ];
    }

    /**
     * @param  mixed  $structured
     * @return list<array{item:string,qty:float|null,unit:string|null,raw:string|null,prep:string|null}>
     */
    private static function structuredItems(mixed $structured): array
    {
        if (! is_array($structured) || ! is_array($structured['items'] ?? null)) {
            return [];
        }

        $items = [];
        foreach ($structured['items'] as $item) {
            if (! is_array($item)) {
                continue;
            }

            $items[] = [
                'item' => is_string($item['item'] ?? null) ? $item['item'] : '',
                'qty' => is_numeric($item['qty'] ?? null) ? (float) $item['qty'] : null,
                'unit' => is_string($item['unit'] ?? null) ? $item['unit'] : null,
                'raw' => is_string($item['raw'] ?? null) ? $item['raw'] : null,
                'prep' => is_string($item['prep'] ?? null) ? $item['prep'] : null,
            ];
        }

        return $items;
    }
}
