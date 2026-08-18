<?php

namespace App\Support;

/**
 * Halal gate for user-generated content (recipes, notes, posts, comments).
 *
 * Scans free text with the canonical pork + alcohol regexes from
 * /home/mamoun/ai/recipe-meal/haram-filter.json (ported 1:1 to PHP
 * preg_match, case-insensitive). Matching content is rejected with 422 by
 * the callers, listing the offending terms.
 *
 * Porting notes, mirrored from the JSON:
 *  - alcohol terms carry negative lookaheads so vinegar forms pass
 *    (wine vinegar / sherry vinegar / beer vinegar are halal);
 *  - "ham" uses word boundaries so hamburger/graham never match;
 *  - "beer" excludes ginger beer and root beer (non-alcoholic).
 */
class HalalGate
{
    /**
     * [term, pattern] pairs, in report order. Keep in sync with
     * haram-filter.json (the canonical source).
     */
    private const PATTERNS = [
        // Pork.
        ['pork', '/\bpork\b/iu'],
        ['bacon', '/\bbacon\b/iu'],
        ['ham', '/\bham\b/iu'],
        ['pig', '/\bpigs?\b/iu'],
        ['lard', '/\blard\b/iu'],
        ['prosciutto', '/\bprosciutto\b/iu'],
        ['pancetta', '/\bpancetta\b/iu'],
        ['guanciale', '/\bguanciale\b/iu'],
        ['chorizo', '/\bchorizo\b/iu'],
        ['salami', '/\bsalami\b/iu'],
        ['pepperoni', '/\bpepperoni\b/iu'],
        ['chitterlings', '/\bchitterlings\b/iu'],
        ['chicharron', '/\bchicharron\w*\b/iu'],
        ['capicola', '/\bcapicol\w+\b/iu'],
        // Alcohol (vinegar lookaheads: vinegar forms are halal).
        ['wine', '/\bwine(?![- ]vinegar)\w*\b/iu'],
        ['sherry', '/\bsherry(?![- ]vinegar)\w*\b/iu'],
        ['beer', '/(?<!ginger )(?<!root )\bbeers?\b(?![- ]vinegar)/iu'],
        ['whisky', '/\bwhisk(e)?y\b/iu'],
        ['bourbon', '/\bbourbon\b/iu'],
        ['rum', '/\brum\b/iu'],
        ['vodka', '/\bvodka\b/iu'],
        ['tequila', '/\btequila\b/iu'],
        ['gin', '/\bgin\b/iu'],
        ['brandy', '/\bbrand(y|ied)\b/iu'],
        ['cognac', '/\bcognac\b/iu'],
        ['champagne', '/\bchampagne\b/iu'],
        ['marsala', '/\bmarsala\b/iu'],
        ['madeira', '/\bmadeira\b/iu'],
        ['mirin', '/\bmirin\b/iu'],
        ['sake', '/\bsake\b/iu'],
        ['vermouth', '/\bvermouth\b/iu'],
        ['liqueur', '/\bliqueur\w*\b/iu'],
        ['liquor', '/\bliquor\b/iu'],
        ['hard cider', '/\bhard cider\b/iu'],
    ];

    /**
     * Scan one or more text fields and return the list of offending terms
     * (unique, pattern order). Empty array = content is halal.
     *
     * @param  list<string|array<string>|null>  $texts
     * @return list<string>
     */
    public static function scan(array $texts): array
    {
        $haystack = implode(
            "\n",
            array_map(
                fn ($text) => is_array($text) ? implode("\n", array_map('strval', $text)) : (string) ($text ?? ''),
                $texts
            )
        );

        if (trim($haystack) === '') {
            return [];
        }

        $matched = [];
        foreach (self::PATTERNS as [$term, $pattern]) {
            if (preg_match($pattern, $haystack) === 1) {
                $matched[] = $term;
            }
        }

        return $matched;
    }

    /**
     * True when any haram term matches — convenience for hot paths that
     * don't need the term list.
     *
     * @param  list<string|array<string>|null>  $texts
     */
    public static function fails(array $texts): bool
    {
        return self::scan($texts) !== [];
    }
}
