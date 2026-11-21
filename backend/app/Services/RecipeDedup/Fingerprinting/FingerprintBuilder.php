<?php

namespace App\Services\RecipeDedup\Fingerprinting;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\FingerprintSet;

/**
 * Deterministic hashing exactly as documented on the FingerprintSet DTO
 * (the frozen definitions every other dedup slice relies on).
 *
 * Hash design:
 * - Build plain assoc arrays with a FIXED literal key order (insertion
 *   order is the key order), then run a RECURSIVE ksort before encoding so
 *   no nested array can ever differ on key ordering.
 * - Lists themselves are explicitly sorted (strings via sort(...,
 *   SORT_STRING); ingredients by (item, unit, qty)) — a recipe whose
 *   ingredients appear in a different order hashes identically.
 * - json_encode with JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES |
 *   JSON_THROW_ON_ERROR (no encoding differences from escaping).
 * - All five values are sha256 over such canonical JSON.
 *
 * Quantity binning makes the exact fingerprint robust to harmless
 * measurement drift while a genuinely different quantity still changes the
 * hash. Bins (documented + tested):
 *   null -> null; |v| < 3 -> nearest 0.5; |v| < 15 -> nearest 1;
 *   |v| < 100 -> nearest 5; else nearest 25.
 */
final class FingerprintBuilder
{
    public function __construct(
        private readonly CulinaryIdentityExtractor $extractor = new CulinaryIdentityExtractor,
    ) {}

    public function build(CandidateRecipe $candidate, ?CulinaryIdentity $identity = null): FingerprintSet
    {
        $identity ??= $this->extractor->extract($candidate);

        $fingerprintPayload = $this->fingerprintPayload($identity);
        $identityPayload = $this->identitySignaturePayload($identity);

        return new FingerprintSet(
            fingerprint: hash('sha256', $this->deterministicJson($fingerprintPayload)),
            identitySignature: hash('sha256', $this->deterministicJson($identityPayload)),
            ingredientComboHash: hash('sha256', $this->deterministicJson(
                $this->sortedUniqueNames([...$identity->mainIngredients, ...$identity->supportingIngredients])
            )),
            mainIngredientHash: hash('sha256', $this->deterministicJson(
                $this->sortedUniqueNames($identity->mainIngredients)
            )),
            titleSignature: hash('sha256', $this->deterministicJson(
                $this->titleTokens($candidate->title)
            )),
            version: max(1, CulinaryIdentity::VERSION),
        );
    }

    /**
     * The FULL normalized identity payload. Cuisine participates ONLY when
     * confidently known (the key is omitted entirely otherwise — an absent
     * key and a null key must never hash differently for the same dish).
     * Ingredient entries keep duplicates (two egg lines stay two entries —
     * 4 + 1 whole is NOT silently 5); they sort by (item, unit, qty).
     *
     * @return array<string, mixed>
     */
    private function fingerprintPayload(CulinaryIdentity $identity): array
    {
        $payload = [
            'canonical_dish' => $identity->canonicalDish,
            'form' => $identity->form,
        ];

        if ($identity->cuisine !== null) {
            $payload['cuisine'] = $identity->cuisine;
        }

        $payload['cooking_method'] = $identity->cookingMethod;
        $payload['prep_method'] = $identity->prepMethod;
        $payload['techniques'] = self::sortStrings($identity->techniques);
        $payload['sauces'] = self::sortStrings($identity->sauces);
        $payload['flavor_markers'] = self::sortStrings($identity->flavorMarkers);

        $ingredients = [];
        foreach ([...$identity->mainIngredients, ...$identity->supportingIngredients] as $ingredient) {
            $ingredients[] = [
                'i' => strtolower(trim((string) ($ingredient['item'] ?? ''))),
                'u' => $ingredient['unit'] ?? null,
                'q' => self::binQuantity($ingredient['qty'] === null ? null : (float) $ingredient['qty']),
            ];
        }

        $payload['ingredients'] = $this->sortIngredients($ingredients);

        return $payload;
    }

    /**
     * The canonical-signature payload used to catch reworded duplicates
     * ("Spaghetti Carbonara" vs "Traditional Roman Carbonara"). Quantities
     * are EXCLUDED (80 g vs 100 g pecorino is the same dish); flavor
     * markers are INCLUDED (classic vs spicy alfredo are different dishes).
     * dish_family participates ALWAYS (as empty string when unknown), so a
     * recipe with an empty canonical dish still hashes on family + main
     * ingredients + core technique classes.
     *
     * @return array<string, mixed>
     */
    private function identitySignaturePayload(CulinaryIdentity $identity): array
    {
        $payload = [
            'canonical_dish' => $identity->canonicalDish,
            // Always present — also when the family is unknown (stable
            // empty string) so the key set never varies between recipes.
            'dish_family' => $identity->dishFamily ?? '',
            'form' => $identity->form,
        ];

        if ($identity->cuisine !== null) {
            $payload['cuisine'] = $identity->cuisine;
        }

        $payload['flavor_markers'] = self::sortStrings($identity->flavorMarkers);
        $payload['core_techniques'] = array_values(array_intersect(
            TechniqueDetector::CORE_TECHNIQUES,
            $identity->techniques
        ));

        $names = array_map(
            fn (array $ingredient): string => strtolower(trim((string) $ingredient['item'])),
            $identity->mainIngredients
        );

        $payload['main_ingredients'] = self::sortStrings(array_unique($names));

        return $payload;
    }

    /**
     * @param  list<array{item:string,qty:float|null,unit:string|null,raw:string|null}>  $ingredients
     * @return list<string>
     */
    private function sortedUniqueNames(array $ingredients): array
    {
        $names = array_map(
            fn (array $ingredient): string => strtolower(trim((string) $ingredient['item'])),
            $ingredients
        );

        return self::sortStrings(array_unique($names));
    }

    /**
     * The title signature is a SECONDARY candidate source only (titles must
     * never decide duplicates alone): sorted unique tokens of the lowercased,
     * punctuation-stripped title, only tokens of length >= 2. Unicode-safe.
     *
     * @return list<string>
     */
    private function titleTokens(string $title): array
    {
        $title = mb_strtolower(trim($title));
        if ($title === '') {
            return [];
        }

        $title = (string) preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $title);

        $tokens = array_values(array_unique(array_filter(
            explode(' ', $title),
            fn (string $token): bool => mb_strlen(trim($token)) >= 2
        )));

        sort($tokens, SORT_STRING);

        return $tokens;
    }

    /**
     * Quantity binning — see the class docblock. Returns the same float for
     * the same input (round-then-multiply; floats only ever land on exact
     * bin multiples like 0.5/1/5/25 so json encoding is stable).
     */
    public static function binQuantity(?float $quantity): ?float
    {
        if ($quantity === null) {
            return null;
        }

        $absolute = abs($quantity);
        $step = match (true) {
            $absolute < 3 => 0.5,
            $absolute < 15 => 1.0,
            $absolute < 100 => 5.0,
            default => 25.0,
        };

        return round($quantity / $step) * $step;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function deterministicJson(array $payload): string
    {
        return json_encode($this->ksortRecursive($payload), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    /**
     * @template TKey of array-key
     *
     * @param  array<TKey, mixed>  $array
     * @return array<TKey, mixed>
     */
    private function ksortRecursive(array $array): array
    {
        ksort($array);

        foreach ($array as &$value) {
            if (is_array($value)) {
                $value = $this->ksortRecursive($value);
            }
        }

        return $array;
    }

    /**
     * @param  list<array{i: string, u: string|null, q: float|null}>  $ingredients
     * @return list<array{i: string, u: string|null, q: float|null}>
     */
    private function sortIngredients(array $ingredients): array
    {
        usort($ingredients, function (array $a, array $b): int {
            $ak = [$a['i'], (string) $a['u'], (float) ($a['q'] ?? -1.0)];
            $bk = [$b['i'], (string) $b['u'], (float) ($b['q'] ?? -1.0)];

            return $ak <=> $bk;
        });

        return $ingredients;
    }

    /**
     * Byte-wise deterministic sort (SORT_STRING): the same set of strings
     * always produces the same list order.
     *
     * @param  list<string>  $strings
     * @return list<string>
     */
    private static function sortStrings(array $strings): array
    {
        sort($strings, SORT_STRING);

        return array_values($strings);
    }
}
