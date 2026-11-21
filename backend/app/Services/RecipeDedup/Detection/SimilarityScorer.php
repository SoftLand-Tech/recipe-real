<?php

namespace App\Services\RecipeDedup\Detection;

use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\DuplicateScore;

/**
 * Layer 2 weighted similarity scorer (pure functions, no DB, no IO).
 *
 * Compares two CulinaryIdentity DTOs over fixed features. Every feature
 * applies its configured weight from config('recipe_dedup.weights') and
 * the total is the normalized weighted mean
 *
 *     total = sum(w_i * f_i) / sum(w_i)
 *
 * A MISSING feature is EXCLUDED from both sums instead of being scored 0.
 * That is deliberate: an absent vector (embeddings disabled), unknown
 * dish family or empty sauce list carries no information, and scoring it
 * 0 would deflate real matches below the thresholds. Weights are read
 * from config at every call so tuning needs no code or restart.
 *
 * The scorer REPORTS corroborations; the decision layer combines them
 * with config('recipe_dedup.thresholds') — never the other way round.
 */
final class SimilarityScorer
{
    /**
     * The ordered feature manifest: config weight key => extractor. The
     * order IS the deterministic tie-break for the explanation.
     *
     * @var list<string>
     */
    private const FEATURES = [
        'vector_cosine',
        'main_ingredients_jaccard',
        'all_ingredients_jaccard',
        'same_canonical_dish',
        'same_dish_family',
        'techniques_jaccard',
        'same_sauce',
        'same_form',
        'same_prep_method',
    ];

    /**
     * @param  list<float>|null  $candidateVector  embedding of the candidate identity (null when unavailable)
     * @param  list<float>|null  $existingVector  embedding of the existing identity (null when unavailable)
     */
    public function score(
        CulinaryIdentity $candidateIdentity,
        CulinaryIdentity $existingIdentity,
        ?array $candidateVector = null,
        ?array $existingVector = null,
    ): DuplicateScore {
        $features = [];

        $candidateVector = self::nonEmptyVector($candidateVector);
        $existingVector = self::nonEmptyVector($existingVector);

        if ($candidateVector !== null && $existingVector !== null) {
            $cosine = self::cosine($candidateVector, $existingVector);

            if ($cosine !== null) {
                $features['vector_cosine'] = max(0.0, $cosine);
            }
        }

        $this->addJaccard(
            $features,
            'main_ingredients_jaccard',
            $candidateIdentity->mainIngredientNames(),
            $existingIdentity->mainIngredientNames(),
        );

        $this->addJaccard(
            $features,
            'all_ingredients_jaccard',
            $candidateIdentity->allIngredientNames(),
            $existingIdentity->allIngredientNames(),
        );

        $this->addEquality(
            $features,
            'same_canonical_dish',
            $candidateIdentity->canonicalDish,
            $existingIdentity->canonicalDish,
        );

        $this->addEquality(
            $features,
            'same_dish_family',
            $candidateIdentity->dishFamily,
            $existingIdentity->dishFamily,
        );

        $this->addSetOverlap(
            $features,
            'techniques_jaccard',
            $candidateIdentity->techniques,
            $existingIdentity->techniques,
            jaccard: true,
        );

        $this->addSetOverlap(
            $features,
            'same_sauce',
            $candidateIdentity->sauces,
            $existingIdentity->sauces,
        );

        $this->addEquality($features, 'same_form', $candidateIdentity->form, $existingIdentity->form);
        $this->addEquality(
            $features,
            'same_prep_method',
            $candidateIdentity->prepMethod,
            $existingIdentity->prepMethod,
        );

        $weights = (array) config('recipe_dedup.weights', []);

        $weightedSum = 0.0;
        $weightSum = 0.0;

        foreach ($features as $name => $value) {
            $weight = (float) ($weights[$name] ?? 0.0);
            $weightedSum += $weight * $value;
            $weightSum += $weight;
        }

        $total = $weightSum > 0.0 ? $weightedSum / $weightSum : 0.0;

        [$corroborations, $passesCorroboration] = $this->corroborations(
            $candidateIdentity,
            $existingIdentity,
            $features,
        );

        return new DuplicateScore(
            total: $total,
            features: $features,
            corroborations: $corroborations,
            passesCorroboration: $passesCorroboration,
            explanation: $this->explanation($features, $weights),
        );
    }

    /**
     * The corroboration pillars (counted, not weighted — see
     * config('recipe_dedup.corroboration')):
     *
     *  1. same non-null dish family,
     *  2. main-ingredient Jaccard >= main_ingredient_jaccard,
     *  3. technique Jaccard >= technique_jaccard,
     *  4. same non-empty canonical dish.
     *
     * @param  array<string, float>  $features
     * @return array{0: int, 1: bool}
     */
    private function corroborations(
        CulinaryIdentity $candidateIdentity,
        CulinaryIdentity $existingIdentity,
        array $features,
    ): array {
        $corroboration = (array) config('recipe_dedup.corroboration', []);
        $count = 0;

        if ($candidateIdentity->dishFamily !== null
            && $existingIdentity->dishFamily !== null
            && self::sameText($candidateIdentity->dishFamily, $existingIdentity->dishFamily)
        ) {
            $count++;
        }

        if (($features['main_ingredients_jaccard'] ?? null) !== null
            && $features['main_ingredients_jaccard'] >= (float) ($corroboration['main_ingredient_jaccard'] ?? 0.7)
        ) {
            $count++;
        }

        if (($features['techniques_jaccard'] ?? null) !== null
            && $features['techniques_jaccard'] >= (float) ($corroboration['technique_jaccard'] ?? 0.6)
        ) {
            $count++;
        }

        if (($features['same_canonical_dish'] ?? 0.0) === 1.0) {
            // A canonical dish is only comparable when both sides have one;
            // the feature itself is excluded on any empty side.
            $count++;
        }

        $minRules = max(0, (int) ($corroboration['min_rules'] ?? 2));

        return [$count, $count >= $minRules];
    }

    /**
     * "Top 3 contributing features" — weight*value desc, config key order
     * as the deterministic tie-break.
     *
     * @param  array<string, float>  $features
     * @param  array<string, mixed>  $weights
     */
    private function explanation(array $features, array $weights): string
    {
        if ($features === []) {
            return 'no comparable features now';
        }

        $contributionOrder = 0;
        $ranked = [];

        foreach (self::FEATURES as $name) {
            if (! array_key_exists($name, $features)) {
                continue;
            }

            $ranked[] = [
                'name' => $name,
                'contribution' => (float) ($weights[$name] ?? 0.0) * $features[$name],
                'order' => $contributionOrder++,
            ];
        }

        usort($ranked, function (array $a, array $b): int {
            $byContribution = $b['contribution'] <=> $a['contribution'];

            return $byContribution !== 0 ? $byContribution : $a['order'] <=> $b['order'];
        });

        $parts = [];

        foreach (array_slice($ranked, 0, 3) as $entry) {
            $parts[] = sprintf('%s=%.4f', $entry['name'], $features[$entry['name']]);
        }

        return implode('; ', $parts);
    }

    /**
     * Jaccard on a pair of value sets, recorded only when BOTH sets carry
     * information: the feature is EXCLUDED when both sides are empty; a
     * one-sided empty set is real disagreement and scores 0.0.
     *
     * @param  array<string, float>  $features
     * @param  list<string>  $candidate
     * @param  list<string>  $existing
     */
    private function addJaccard(array &$features, string $name, array $candidate, array $existing): void
    {
        $candidate = self::set($candidate);
        $existing = self::set($existing);

        if ($candidate === [] && $existing === []) {
            return;
        }

        $features[$name] = self::jaccard($candidate, $existing);
    }

    /**
     * 1.0/0.0 set overlap, recorded only when at least one side is
     * non-empty (both empty carries no information).
     *
     * @param  array<string, float>  $features
     * @param  list<string>  $candidate
     * @param  list<string>  $existing
     */
    private function addSetOverlap(array &$features, string $name, array $candidate, array $existing, bool $jaccard = false): void
    {
        $candidate = self::set($candidate);
        $existing = self::set($existing);

        if ($candidate === [] && $existing === []) {
            return;
        }

        $features[$name] = $jaccard
            ? self::jaccard($candidate, $existing)
            : (count(array_intersect($candidate, $existing)) > 0 ? 1.0 : 0.0);
    }

    /**
     * 1.0/0.0 equality of two scalar facets; the feature is EXCLUDED when
     * either side is empty/null (an unknown on either side carries no
     * verdict — empty never counts as "different").
     *
     * @param  array<string, float>  $features
     */
    private function addEquality(array &$features, string $name, ?string $candidate, ?string $existing): void
    {
        $candidate = self::clean($candidate);
        $existing = self::clean($existing);

        if ($candidate === null || $existing === null) {
            return;
        }

        $features[$name] = self::sameText($candidate, $existing) ? 1.0 : 0.0;
    }

    /**
     * Jaccard similarity of two lowercased sets: |A∩B| / |A∪B|; 0.0 when
     * the union is empty (callers exclude that case before recording).
     *
     * @param  list<string>  $candidate
     * @param  list<string>  $existing
     */
    private static function jaccard(array $candidate, array $existing): float
    {
        $union = array_unique([...$candidate, ...$existing]);

        if ($union === []) {
            return 0.0;
        }

        return count(array_intersect($candidate, $existing)) / count($union);
    }

    /**
     * Cosine of two vectors; null when a side has zero magnitude (the
     * embedder guarantees normalized vectors, this is defensive).
     *
     * @param  list<float>  $a
     * @param  list<float>  $b
     */
    private static function cosine(array $a, array $b): ?float
    {
        $length = min(count($a), count($b));

        if ($length === 0) {
            return null;
        }

        $dot = 0.0;
        $normA = 0.0;
        $normB = 0.0;

        for ($i = 0; $i < $length; $i++) {
            $dot += $a[$i] * $b[$i];
            $normA += $a[$i] * $a[$i];
            $normB += $b[$i] * $b[$i];
        }

        if ($normA <= 0.0 || $normB <= 0.0) {
            return null;
        }

        return $dot / (sqrt($normA) * sqrt($normB));
    }

    /**
     * @param  list<float>|null  $vector
     * @return list<float>|null
     */
    private static function nonEmptyVector(?array $vector): ?array
    {
        if ($vector === null) {
            return null;
        }

        $values = array_values(array_filter(
            array_map(fn (mixed $value): ?float => is_int($value) || is_float($value) ? (float) $value : null,
                $vector,
            ),
            fn (?float $value): bool => $value !== null,
        ));

        return $values === [] ? null : $values;
    }

    /**
     * @param  list<string>  $values
     * @return list<string>
     */
    private static function set(array $values): array
    {
        $out = [];

        foreach ($values as $value) {
            if (! is_string($value)) {
                continue;
            }

            $value = self::clean($value) ?? '';

            if ($value !== '' && ! in_array($value, $out, true)) {
                $out[] = $value;
            }
        }

        return $out;
    }

    private static function clean(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = mb_strtolower(trim($value));

        return $value === '' ? null : $value;
    }

    private static function sameText(string $a, string $b): bool
    {
        return $a === $b;
    }
}
