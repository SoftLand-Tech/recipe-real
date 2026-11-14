<?php

namespace App\Services\RecipeImport;

use App\Models\RecipeImport;
use App\Services\RecipeImport\Data\RecipeExtraction;

class RecipeExtractionNormalizer
{
    /**
     * Convert any supported provider response into the draft shape used by
     * both API clients and the publish service.
     *
     * @param  array<string, mixed>  $payload
     */
    public function normalize(array $payload, RecipeImport $import): RecipeExtraction
    {
        $payload = $this->unwrap($payload);
        $warnings = $this->stringList($payload['warnings'] ?? []);
        $fieldsConfidence = is_array($payload['confidence'] ?? null)
            ? $payload['confidence']
            : [];

        $ingredients = [];
        $rawIngredients = is_array($payload['ingredients'] ?? null)
            ? $payload['ingredients']
            : [];

        foreach (array_slice($rawIngredients, 0, 60) as $ingredient) {
            if (is_string($ingredient)) {
                $raw = trim($ingredient);
                $item = null;
                $quantity = null;
                $unit = null;
                $prep = null;
                $optional = false;
                $group = null;
                $ingredientConfidence = null;
                $quantityDisplay = null;
            } elseif (is_array($ingredient)) {
                $raw = trim((string) ($ingredient['raw'] ?? $ingredient['text'] ?? $ingredient['name'] ?? ''));
                $item = $this->nullableString($ingredient['item'] ?? $ingredient['name'] ?? null);
                $quantity = $this->nullableNumber($ingredient['quantity'] ?? $ingredient['qty'] ?? null);
                $quantityDisplay = $this->nullableString($ingredient['quantity_display'] ?? $ingredient['qty_display'] ?? null);
                $unit = $this->nullableString($ingredient['unit'] ?? null);
                $prep = $this->nullableString($ingredient['prep'] ?? $ingredient['preparation'] ?? null);
                $optional = (bool) ($ingredient['optional'] ?? false);
                $group = $this->nullableString($ingredient['group'] ?? null);
                $ingredientConfidence = $this->nullableNumber($ingredient['confidence'] ?? null);
            } else {
                continue;
            }

            if ($raw === '') {
                continue;
            }

            $ingredients[] = [
                'raw' => $raw,
                'quantity' => $quantity,
                'quantity_display' => $quantityDisplay,
                'unit' => $unit,
                'item' => $item,
                'prep' => $prep,
                'optional' => $optional,
                'group' => $group,
                'confidence' => $ingredientConfidence,
            ];
        }

        if (count($rawIngredients) > 60) {
            $warnings[] = 'ingredients_truncated';
        }
        if ($ingredients === []) {
            $warnings[] = 'ingredients_missing';
        }

        $steps = [];
        $rawSteps = is_array($payload['steps'] ?? null) ? $payload['steps'] : [];

        foreach (array_slice($rawSteps, 0, 40) as $step) {
            if (is_string($step)) {
                $description = trim($step);
                $descriptionAr = null;
                $stepType = 'active';
                $minutes = null;
                $literalMinutes = null;
                $stepConfidence = null;
            } elseif (is_array($step)) {
                $description = trim((string) ($step['description'] ?? $step['text'] ?? ''));
                $descriptionAr = $this->nullableString($step['description_ar'] ?? null);
                $stepTypeValue = $step['step_type'] ?? 'active';
                $stepType = in_array($stepTypeValue, ['active', 'passive', 'cleanup'], true)
                    ? $stepTypeValue
                    : 'active';
                $minutes = $this->nullableInteger($step['minutes_estimated'] ?? $step['minutes'] ?? null, 0, 1440);
                $literalMinutes = $this->nullableInteger($step['literal_minutes'] ?? null, 0, 1440);
                $stepConfidence = $this->nullableNumber($step['confidence'] ?? null);
            } else {
                continue;
            }

            if ($description === '') {
                continue;
            }

            $steps[] = [
                'description' => $description,
                'description_ar' => $descriptionAr,
                'minutes_estimated' => $minutes,
                'literal_minutes' => $literalMinutes,
                'step_type' => $stepType,
                'confidence' => $stepConfidence,
            ];
        }

        if (count($rawSteps) > 40) {
            $warnings[] = 'steps_truncated';
        }
        if ($steps === []) {
            $warnings[] = 'steps_missing';
        }

        $servings = $this->nullableInteger($payload['servings'] ?? null, 1, 50);
        $prepMinutes = $this->nullableInteger($payload['prep_time_minutes'] ?? $payload['prep_minutes'] ?? null, 0, 1440);
        $cookMinutes = $this->nullableInteger($payload['cook_time_minutes'] ?? $payload['cook_minutes'] ?? null, 0, 1440);
        $totalMinutes = $this->nullableInteger(
            $payload['total_time_minutes'] ?? $payload['estimated_minutes'] ?? $payload['time_minutes'] ?? null,
            1,
            1440,
        );

        if ($totalMinutes === null && ($prepMinutes !== null || $cookMinutes !== null)) {
            $sum = ($prepMinutes ?? 0) + ($cookMinutes ?? 0);
            $totalMinutes = $sum > 0 ? min($sum, 1440) : null;
        }
        if ($totalMinutes === null) {
            $warnings[] = 'total_time_missing';
        }

        $warnings = array_values(array_unique(array_merge($warnings, $this->requiredWarnings(
            $payload,
            $ingredients,
            $steps,
            $totalMinutes,
        ))));

        $confidence = [
            'overall' => $this->nullableNumber($payload['overall_confidence'] ?? $fieldsConfidence['overall'] ?? null),
            'fields' => $fieldsConfidence,
        ];

        $draft = [
            'schema_version' => 1,
            'title' => $this->nullableString($payload['title'] ?? $payload['name'] ?? null),
            'title_ar' => $this->nullableString($payload['title_ar'] ?? null),
            'description' => $this->nullableString($payload['description'] ?? $payload['summary'] ?? null),
            'language' => $this->nullableString($payload['language'] ?? null),
            'servings' => $servings,
            'prep_time_minutes' => $prepMinutes,
            'cook_time_minutes' => $cookMinutes,
            'total_time_minutes' => $totalMinutes,
            'ingredients' => $ingredients,
            'steps' => $steps,
            'category' => $this->nullableString($payload['category'] ?? null),
            'keywords' => array_values(array_unique(array_filter(
                array_map(
                    fn (mixed $keyword): ?string => $this->nullableString($keyword),
                    is_array($payload['keywords'] ?? null) ? $payload['keywords'] : [],
                ),
                fn (?string $keyword): bool => $keyword !== null && trim($keyword) !== '',
            ))),
            'nutrition' => $this->normalizeNutrition($payload['nutrition'] ?? $payload),
            'cover_image_url' => $this->nullableString($payload['cover_image_url'] ?? $payload['image_url'] ?? null),
            'attribution' => [
                'source_url' => $import->source_url,
                'platform' => $import->source_platform,
                'author_name' => $this->nullableString($payload['author_name'] ?? null),
                'author_url' => $this->nullableString($payload['author_url'] ?? null),
            ],
            'confidence' => $confidence,
            'warnings' => $warnings,
        ];

        return new RecipeExtraction($draft, $warnings, $confidence);
    }

    /** @param array<string, mixed> $payload */
    private function unwrap(array $payload): array
    {
        foreach (['recipe', 'data', 'result', 'output'] as $key) {
            if (is_array($payload[$key] ?? null)) {
                return $this->unwrap($payload[$key]);
            }
        }

        return $payload;
    }

    private function nullableString(mixed $value): ?string
    {
        if (! is_scalar($value)) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function nullableNumber(mixed $value): int|float|null
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }

        $number = (float) $value;

        return floor($number) === $number ? (int) $number : $number;
    }

    private function nullableInteger(mixed $value, int $min, int $max): ?int
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }

        $number = (int) round((float) $value);

        return $number >= $min && $number <= $max ? $number : null;
    }

    /** @param mixed $value @return list<string> */
    private function stringList(mixed $value): array
    {
        if (is_string($value)) {
            return trim($value) === '' ? [] : [trim($value)];
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter(
            array_map(
                fn (mixed $item): ?string => $this->nullableString($item),
                $value,
            ),
            fn (?string $item): bool => $item !== null,
        ));
    }

    /** @param mixed $value @return array<string, int|float|null> */
    private function normalizeNutrition(mixed $value): array
    {
        $value = is_array($value) ? $value : [];

        return [
            'calories' => $this->nullableNumber($value['calories'] ?? null),
            'protein_g' => $this->nullableNumber($value['protein_g'] ?? $value['protein'] ?? null),
            'fat_g' => $this->nullableNumber($value['fat_g'] ?? $value['fat'] ?? null),
            'carbohydrates_g' => $this->nullableNumber($value['carbohydrates_g'] ?? $value['carbs_g'] ?? $value['carbohydrates'] ?? null),
            'fiber_g' => $this->nullableNumber($value['fiber_g'] ?? $value['fiber'] ?? null),
        ];
    }

    /** @param array<string, mixed> $payload @param list<array<string, mixed>> $ingredients @param list<array<string, mixed>> $steps */
    private function requiredWarnings(array $payload, array $ingredients, array $steps, ?int $totalMinutes): array
    {
        $warnings = [];
        if ($this->nullableString($payload['title'] ?? $payload['name'] ?? null) === null) {
            $warnings[] = 'title_missing';
        }
        if ($ingredients === []) {
            $warnings[] = 'ingredients_missing';
        }
        if ($steps === []) {
            $warnings[] = 'steps_missing';
        }
        if ($totalMinutes === null) {
            $warnings[] = 'total_time_missing';
        }

        return $warnings;
    }
}
