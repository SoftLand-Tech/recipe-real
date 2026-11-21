<?php

namespace App\Services\RecipeDedup\Embeddings;

use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * Deterministic culinary-description text fed to the embedding provider.
 *
 * The text is composed from the CulinaryIdentity ONLY (never the raw
 * recipe): no quantities, no units, no marketing wording — an 80g-vs-100g
 * pecorino difference must not change the embedding, but role context
 * (main vs supporting ingredients) does survive. Labels stay English
 * regardless of the $language argument; content is language-agnostic.
 *
 * Determinism contract: the same identity string-for-string produces the
 * identical bytes, so EmbeddingTextBuilder::signature() is a stable
 * change-detection hash — recipe_embeddings.text_hash gates every
 * re-embedding decision.
 */
final class EmbeddingTextBuilder
{
    /** Bump this when the text composition changes materially; every
     * existing embedding becomes stale (mixed text_versions in the store
     * are fine — cosine degrades only by the old recipe's own drift). */
    public const TEXT_VERSION = 1;

    /** Hard cap: embedding providers degrade on very long inputs and the
     * culinary identity carries everything relevant in far fewer chars. */
    private const MAX_CHARS = 700;

    /** Ingredient list caps (roles cap separately; main lists first). */
    private const MAX_MAIN_INGREDIENTS = 10;

    private const MAX_SUPPORTING_INGREDIENTS = 15;

    /**
     * The single normalized description line set. Sections are skipped
     * when empty; the same identity yields byte-identical output.
     *
     * $language is accepted for forward compatibility (bilingual
     * identities) but does not change the output: embedding text is one
     * language-neutral culinary description per the engine design.
     */
    public static function build(CulinaryIdentity $identity, string $language = 'en'): string
    {
        $segments = [];

        // Dish identity first. When no reliable canonical dish was
        // extractable, family + form below carry the shape instead — we
        // NEVER invent a name from the raw title.
        if (self::clean($identity->canonicalDish) !== '') {
            $segments[] = 'Dish: '.self::clean($identity->canonicalDish).'.';
        }

        if (($family = self::clean((string) $identity->dishFamily)) !== '') {
            $segments[] = 'Family: '.$family.'.';
        }

        if (($form = self::clean((string) $identity->form)) !== '') {
            $segments[] = 'Form: '.$form.'.';
        }

        if (($cuisine = self::clean((string) $identity->cuisine)) !== '') {
            $segments[] = 'Cuisine: '.$cuisine.'.';
        }

        if (($main = self::names($identity->mainIngredientNames(), self::MAX_MAIN_INGREDIENTS)) !== '') {
            $segments[] = 'Main ingredients: '.$main.'.';
        }

        if (($supporting = self::names($identity->supportingIngredientNames(), self::MAX_SUPPORTING_INGREDIENTS)) !== '') {
            $segments[] = 'Supporting: '.$supporting.'.';
        }

        if (($techniques = self::values($identity->techniques)) !== '') {
            $segments[] = 'Techniques: '.$techniques.'.';
        }

        if (($cookingMethod = self::clean((string) $identity->cookingMethod)) !== '') {
            $segments[] = 'Cooking method: '.$cookingMethod.'.';
        }

        if (($prep = self::clean((string) $identity->prepMethod)) !== '') {
            $segments[] = 'Prep: '.$prep.'.';
        }

        // Sauce types; the extractor's literal 'none' marker is not a
        // culinary descriptor and stays out of the embedding text.
        $sauces = array_values(array_filter($identity->sauces, fn (string $s): bool => $s !== 'none'));
        if (($sauce = self::values($sauces)) !== '') {
            $segments[] = 'Sauce: '.$sauce.'.';
        }

        if (($flavor = self::values($identity->flavorMarkers)) !== '') {
            $segments[] = 'Flavor: '.$flavor.'.';
        }

        if (($notes = self::values($identity->characteristics)) !== '') {
            $segments[] = 'Notes: '.$notes.'.';
        }

        return self::cap(implode(' ', $segments));
    }

    /**
     * THE change-detection hash stored as recipe_embeddings.text_hash:
     * hash of (model | text version | text). A different model or any
     * identity drift produces a new signature → re-embedding.
     */
    public static function signature(CulinaryIdentity $identity, string $model): string
    {
        return hash('sha256', $model.'|'.self::TEXT_VERSION.'|'.self::build($identity));
    }

    /**
     * Collapse whitespace runs, drop OUTER separator residue; UTF-8 safe
     * (mb_* everywhere — Arabic content flows through untouched).
     */
    private static function clean(string $value): string
    {
        $value = trim((string) preg_replace('/\s+/u', ' ', $value));

        return rtrim($value, '.,') === '' ? '' : $value;
    }

    /**
     * Comma-joined, deduped, whitespace-clean value list (order kept from
     * the identity — slices upstream already normalize order).
     *
     * @param  list<string>  $values
     */
    private static function values(array $values): string
    {
        return self::clean(implode(', ', self::dedupe($values)));
    }

    /**
     * Same as values() but hard-capped at $max entries (main ingredients
     * dominate the vector; long supporting tails are noise).
     *
     * @param  list<string>  $names
     */
    private static function names(array $names, int $max): string
    {
        return self::values(array_slice(self::dedupe($names), 0, $max));
    }

    /**
     * @param  list<string>  $values
     * @return list<string>
     */
    private static function dedupe(array $values): array
    {
        $out = [];

        foreach ($values as $value) {
            $value = self::clean($value);

            if ($value !== '' && ! in_array($value, $out, true)) {
                $out[] = $value;
            }
        }

        return $out;
    }

    /**
     * Hard cap at ~MAX_CHARS, truncated at the last word boundary — no
     * warnings/notice even when the identity is one giant unbroken word.
     */
    private static function cap(string $text): string
    {
        if (mb_strlen($text) <= self::MAX_CHARS) {
            return $text;
        }

        $cut = mb_substr($text, 0, self::MAX_CHARS);
        $boundary = mb_strrpos($cut, ' ');

        if ($boundary !== false && $boundary > 0) {
            $cut = mb_substr($cut, 0, $boundary);
        }

        return rtrim($cut, ' ,.');
    }
}
