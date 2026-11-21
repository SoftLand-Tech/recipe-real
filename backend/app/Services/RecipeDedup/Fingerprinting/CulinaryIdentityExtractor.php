<?php

namespace App\Services\RecipeDedup\Fingerprinting;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * Builds the full CulinaryIdentity from a CandidateRecipe — pure functions,
 * deterministic rules, no AI, no HTTP.
 *
 * The two most consequential deterministic rules live here, both documented
 * for review:
 *
 *  1. MAIN vs SUPPORTING ingredients: MAIN = any protein + any staple +
 *     cheese/dairy beyond garnish quantity + non-aromatic vegetables
 *     (tomato IS main; basil/parsley/mint/dill are garnish). SUPPORTING =
 *     spices/herbs/aromatics/oils/vinegars/condiments/leaveners/stock/
 *     water/sugar/salt/aromatic garnish. Both sides keep the normalizer's
 *     qty/unit. When nothing qualifies as main, the highest-value
 *     staple-ish item is promoted; the sparse_metadata characteristic is
 *     added ONLY when the recipe had no ingredients at all.
 *
 *  2. Canonical dish from the title, with an audited fallback ladder:
 *     marketing-adjective strip -> known-dish alias rewrite ->
 *     dish+form split (the form moves into identity.form) -> and, only
 *     when the title was NOT conclusive, a tiny famous-dish recognizer on
 *     the MAIN ingredients (e.g. pasta + egg + guanciale + pecorino and no
 *     cream == spaghetti carbonara). That last step is what lets the
 *     deliberately paraphrased "Authentic Roman Style Pasta with Egg and
 *     Cured Pork" fixture converge with "Spaghetti Carbonara" — the point
 *     of identity signatures. Empty string when nothing is reliable.
 */
final class CulinaryIdentityExtractor
{
    /**
     * Marketing/placeholder adjectives stripped from titles before dish
     * resolution (plus "style suffixes" like "restaurant style ... /
     * ... style pasta" and quantity words). Never strips variety words.
     */
    private const TITLE_MARKETING = [
        "world's best", 'worlds best', 'old-fashioned', 'old fashioned',
        "grandma's", 'grandma', 'grandmas', 'nana\'s', 'restaurant-style', 'restaurant style',
        'authentic', 'traditional', 'classic', 'homemade', 'easy', 'best', 'perfect',
        'simple', 'original', 'ultimate', 'copycat', 'quick', 'true', 'real', 'genuine',
        'style',  // "roman style pasta" -> "pasta" (adjacent-word suffix below)
    ];

    /** Leading flavor adjectives peeled off titles into flavor markers. */
    private const TITLE_FLAVOR_WORDS = [
        'spicy' => 'spicy', 'hot' => 'spicy', 'smoky' => 'smoky', 'smoked' => 'smoky',
        'sweet' => 'sweet', 'tangy' => 'tangy', 'zesty' => 'tangy',
        'garlicky' => 'garlicky', 'creamy' => 'creamy', 'herbed' => 'herby', 'herby' => 'herby',
    ];

    /**
     * Origin/country/region adjectives dropped from the dish name after
     * alias resolution — nationality is metadata (cuisine detector's job),
     * not dish identity ("Egyptian Ful Medames" -> ful medames).
     */
    private const TITLE_ORIGIN_WORDS = [
        'egyptian', 'italian', 'american', 'mexican', 'french', 'spanish',
        'greek', 'turkish', 'moroccan', 'tunisian', 'lebanese', 'syrian',
        'palestinian', 'jordanian', 'indian', 'pakistani', 'chinese',
        'japanese', 'korean', 'thai', 'vietnamese', 'german', 'russian',
        'brazilian', 'roman', 'romana', 'sicilian', 'tuscan', 'neapolitan',
        'cajun', 'creole', 'mediterranean', 'oriental', 'levantine',
    ];

    /** Generic single words that are NOT a dish (reliability gate). */
    private const GENERIC_DISH_WORDS = [
        'pasta', 'soup', 'stew', 'salad', 'sauce', 'curry', 'casserole',
        'bowl', 'dish', 'loaf', 'wrap', 'risotto', 'pilaf',
    ];

    /** Quantity words dropped from titles. */
    private const TITLE_QUANTITY_WORDS = [
        'serving', 'servings', 'minute', 'minutes', 'ways', 'way', 'ingredient', 'ingredients',
    ];

    /**
     * The known-dish alias ladder: alias (regex) -> canonical dish. Applied
     * on the cleaned title via word-boundary rewrite; a leading duplicate of
     * the expansion's first word collapses ("spaghetti carbonara" stays).
     */
    private const DISH_ALIASES = [
        'carbonara' => 'spaghetti carbonara',
        'koshari' => 'koshari', 'kushari' => 'koshari', 'koshary' => 'koshari',
        'hummus' => 'hummus', 'hommus' => 'hummus', 'hommos' => 'hummus',
        'bolognese' => 'spaghetti bolognese',
        'aglio e olio' => 'spaghetti aglio e olio',
        'shakshuka' => 'shakshuka', 'chakchouka' => 'shakshuka', 'shakshouka' => 'shakshuka',
        'ful medames' => 'ful medames', 'foul medames' => 'ful medames',
        'foul mudammas' => 'ful medames', 'ful mudammas' => 'ful medames',
        'molokhia' => 'molokhia', 'mulukhiyah' => 'molokhia', 'molokhya' => 'molokhia',
        'feteer meshaltet' => 'feteer meshaltet', // keeps its name
        'lasagna' => 'lasagna',
        'lasagne' => 'lasagna',
    ];

    /**
     * The famous-dish recognizer: dish -> main-ingredient guard rails, used
     * ONLY when the title yielded nothing reliable. Deliberately tiny and
     * strict (all groups must be present, none list must be absent) since a
     * wrong canonical dish is worse than an empty one.
     */
    private const FAMOUS_DISHES = [
        [
            'dish' => 'spaghetti carbonara',
            'all' => [
                ['spaghetti', 'fettuccine', 'penne', 'rigatoni', 'bucatini', 'pasta'],
                ['egg'],
                ['guanciale', 'pancetta', 'bacon', 'pork cheek'],
                ['pecorino', 'parmesan'],
            ],
            'none' => ['heavy cream', 'cream'],
        ],
        [
            'dish' => 'chicken alfredo',
            'all' => [
                ['spaghetti', 'fettuccine', 'penne', 'rigatoni', 'pasta'],
                ['chicken breast', 'chicken'],
                ['heavy cream'],
                ['parmesan cheese'],
            ],
            'none' => [],
        ],
        [
            'dish' => 'ful medames',
            'all' => [['fava beans'], ['cumin', 'lemon', 'olive oil']],
            'none' => [],
        ],
        [
            'dish' => 'koshari',
            'all' => [['rice'], ['lentil'], ['pasta', 'macaroni'], ['chickpea']],
            'none' => [],
        ],
        [
            'dish' => 'shakshuka',
            'all' => [['egg'], ['tomato'], ['cumin', 'paprika']],
            'none' => [],
        ],
        [
            'dish' => 'molokhia',
            'all' => [['molokhia']],
            'none' => [],
        ],
        [
            'dish' => 'spaghetti aglio e olio',
            'all' => [['spaghetti', 'pasta'], ['garlic'], ['olive oil']],
            'none' => ['egg', 'cream', 'guanciale', 'pancetta', 'bacon'],
        ],
    ];

    /** Proteins -> MAIN (documented in the class docblock). NOTE: no bare
     * "pea" — the prefix rule would swallow "peanut"/"pear". */
    private const PROTEIN_ITEMS = [
        'chicken', 'beef', 'steak', 'lamb', 'pork', 'ham', 'bacon', 'pancetta',
        'guanciale', 'sausage', 'chorizo', 'turkey', 'duck', 'fish', 'salmon',
        'tuna', 'cod', 'tilapia', 'shrimp', 'prawn', 'squid', 'clam', 'mussel',
        'egg', 'tofu', 'tempeh', 'chickpea', 'fava beans', 'lentil', 'beans',
        'kidney bean', 'black bean', 'green pea',
    ];

    /** Staples -> MAIN. */
    private const STAPLE_ITEMS = [
        'spaghetti', 'fettuccine', 'penne', 'rigatoni', 'farfalle', 'linguine',
        'macaroni', 'tagliatelle', 'bucatini', 'lasagna', 'manicotti',
        'tortellini', 'tortelloni', 'ravioli', 'orzo', 'couscous', 'gnocchi',
        'pasta', 'noodle', 'ramen', 'udon', 'soba', 'rice', 'flour',
        'all-purpose flour', 'bread', 'toast', 'pita', 'tortilla', 'potato',
        'oat', 'oats', 'oatmeal', 'cornmeal', 'polenta', 'bulgur', 'quinoa',
    ];

    /** Dairy/cheese -> MAIN beyond garnish quantity. */
    private const DAIRY_ITEMS = ['cheese', 'yogurt', 'milk', 'cream', 'butter', 'labneh', 'cream cheese', 'ricotta', 'mascarpone'];

    /** Non-aromatic vegetables -> MAIN. */
    private const VEGETABLE_ITEMS = [
        'tomato', 'bell pepper', 'chili', 'zucchini', 'eggplant', 'okra',
        'corn', 'mushroom', 'broccoli', 'cauliflower', 'spinach', 'kale',
        'cabbage', 'lettuce', 'cucumber', 'pumpkin', 'squash', 'green bean',
        'asparagus', 'beet', 'turnip',
    ];

    /** Aromatic vegetables / garnish herbs -> always SUPPORTING. */
    private const AROMATIC_ITEMS = [
        'onion', 'shallot', 'garlic', 'ginger', 'carrot', 'celery', 'leek',
        'green bell', 'scallion', 'spring onion', 'lemon', 'lime', 'cilantro',
        'parsley', 'basil', 'mint', 'dill', 'thyme', 'rosemary', 'oregano',
        'bay leaf', 'tarragon', 'chive',
    ];

    /** Everything else -> SUPPORTING (spices, oils, condiments, leaveners...). */
    private const SUPPORTING_HINTS = [
        'oil', 'vinegar', 'stock', 'broth', 'water', 'sugar', 'salt', 'pepper',
        ' spice', 'spice', 'cumin', 'paprika', 'cinnamon', 'turmeric', 'coriander',
        'cardamom', 'clove', 'nutmeg', 'allspice', 'saffron', 'vanilla', 'baking powder',
        'baking soda', 'yeast', 'mustard', 'mayonnaise', 'ketchup', 'soy sauce', 'harissa',
        'sriracha', 'worchestershire', 'hot sauce', 'honey', 'syrup', 'jam', 'nut', 'seed',
        'raisin', 'chocolate', 'cocoa', 'coffee', 'tea', 'wine', 'alcohol', 'lemon juice',
        'lime juice', 'cornstarch', 'starch', 'gelatin', 'food coloring', 'flavoring',
        'extract', 'seasoning', 'cayenne', 'chipotle', 'jalapeno', 'pickle', 'olive',
    ];

    /** Garnish quantity caps: dairy/veggies below these stay supporting. */
    private const GARNISH_CAP_GRAMS = 30.0;

    private const GARNISH_CAP_ML = 45.0;

    private const GARNISH_CAP_COUNT = 2.0;

    public function __construct(
        private readonly IngredientNormalizer $normalizer = new IngredientNormalizer,
        private readonly CuisineDetector $cuisineDetector = new CuisineDetector,
        private readonly TechniqueDetector $techniqueDetector = new TechniqueDetector,
    ) {}

    /**
     * Extract the full culinary identity (pure — no DB).
     */
    public function extract(CandidateRecipe $candidate): CulinaryIdentity
    {
        $ingredients = $this->normalizer->set($this->ingredientInputs($candidate));
        $title = trim($candidate->title);

        $ingredientsEmpty = $ingredients === [];
        [$mains, $supporting] = $this->classifyIngredients($ingredients);
        if ($mains === [] && ! $ingredientsEmpty) {
            // Nothing qualified as main (sauce-only recipes) — promote the
            // highest-value staple-ish supporting item, else leave empty.
            $mains = $this->promoteStaple($supporting);
        }

        $techniques = $this->techniqueDetector->techniquesFromSteps($candidate->steps);
        $dishFamily = $this->resolveDishFamily($candidate, $ingredients);
        $canonicalDish = $this->canonicalDish($candidate, $title, $mains);
        $cuisine = $this->resolveCuisine($candidate, $canonicalDish, $dishFamily, $mains);
        $form = $this->techniqueDetector->formFrom($title, $this->normalizer->namesOnly($ingredients), $dishFamily);
        $sauces = $this->techniqueDetector->saucesFrom($title, $this->normalizer->namesOnly($ingredients), $candidate->steps);
        $flavorMarkers = $this->flavorMarkers($candidate, $title, $ingredients, $dishFamily);
        $characteristics = $this->characteristics($candidate, $title, $ingredientsEmpty, $flavorMarkers);

        return new CulinaryIdentity(
            canonicalDish: $canonicalDish,
            dishFamily: $dishFamily,
            cuisine: $cuisine,
            category: $candidate->category !== null && trim($candidate->category) !== '' ? trim($candidate->category) : null,
            form: $form,
            mainIngredients: $mains,
            supportingIngredients: $supporting,
            techniques: $techniques,
            cookingMethod: $this->techniqueDetector->cookingMethodFrom($techniques),
            prepMethod: $this->techniqueDetector->prepMethodFrom($techniques),
            sauces: $sauces,
            flavorMarkers: $flavorMarkers,
            characteristics: $characteristics,
        );
    }

    /**
     * The ingredient inputs to normalize: structured items win when present
     * (they carry Stage A parsing quality even when items need the raw
     * fallback inside), otherwise raw lines. Never both — the raw list
     * duplicates the structured one, and the same line normalized twice
     * would double the quantities in the fingerprint.
     *
     * @return list<string|array<string, mixed>>
     */
    private function ingredientInputs(CandidateRecipe $candidate): array
    {
        if ($candidate->ingredientsStructured !== []) {
            return $candidate->ingredientsStructured;
        }

        return $candidate->ingredientsRaw;
    }

    /**
     * Split normalized ingredients into [mains, supporting] by the
     * documented deterministic rule.
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $ingredients
     * @return array{0: list<array{item: string, qty: float|null, unit: string|null, raw: string}>, 1: list<array{item: string, qty: float|null, unit: string|null, raw: string}>}
     */
    private function classifyIngredients(array $ingredients): array
    {
        $mains = [];
        $supporting = [];

        foreach ($ingredients as $entry) {
            $class = $this->ingredientRole($entry['item'], $entry['qty'], $entry['unit']);
            if ($class === 'main') {
                $mains[] = $entry;
            } else {
                $supporting[] = $entry;
            }
        }

        return [$mains, $supporting];
    }

    /**
     * The role of ONE normalized ingredient.
     *
     * @return string 'main' | 'supporting'
     */
    private function ingredientRole(string $item, ?float $qty, ?string $unit): string
    {
        if ($item === '') {
            return 'supporting';
        }

        // Proteins and staples are unconditionally MAIN.
        if ($this->matchesAny($item, self::PROTEIN_ITEMS)) {
            return 'main';
        }

        if ($this->matchesAny($item, self::STAPLE_ITEMS)) {
            return 'main';
        }

        // Aromatics/garnish are unconditionally SUPPORTING (checked before
        // the vegetable list — "green bell pepper" is a vegetable pepper,
        // but scallion/parsley are not; the AROMATIC list wins ties).
        if ($this->matchesAny($item, self::AROMATIC_ITEMS)) {
            return 'supporting';
        }

        // Dairy: main beyond garnish quantity, supporting as a garnish dust.
        if ($this->matchesAny($item, self::DAIRY_ITEMS)) {
            return $this->beyondGarnish($qty, $unit) ? 'main' : 'supporting';
        }

        // Non-aromatic vegetables (tomato IS main).
        if ($this->matchesAny($item, self::VEGETABLE_ITEMS)) {
            return 'main';
        }

        // Everything else (spices, oils, condiments, ...) stays supporting.
        return 'supporting';
    }

    /**
     * Whether a quantity is clearly beyond garnish scale: unknown (null)
     * quantities are generous (counts as beyond), tiny gram/ml/count
     * amounts are garnish.
     */
    private function beyondGarnish(?float $qty, ?string $unit): bool
    {
        if ($qty === null) {
            return true;
        }

        return match ($unit) {
            'gram' => $qty > self::GARNISH_CAP_GRAMS,
            'ml' => $qty > self::GARNISH_CAP_ML,
            'count' => $qty > self::GARNISH_CAP_COUNT,
            default => true, // unknown unit — do not silently demote
        };
    }

    /**
     * Promote the highest-value staple-ish item to main when nothing
     * qualified (sauce-only recipes): priority dairy > starch > first item.
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $supporting
     * @return list<array{item: string, qty: float|null, unit: string|null, raw: string}>
     */
    private function promoteStaple(array $supporting): array
    {
        if ($supporting === []) {
            return [];
        }

        foreach (self::DAIRY_ITEMS as $needle) {
            foreach ($supporting as $entry) {
                if (str_contains($entry['item'], $needle)) {
                    return [$entry];
                }
            }
        }

        foreach (self::STAPLE_ITEMS as $needle) {
            foreach ($supporting as $entry) {
                if (str_contains($entry['item'], $needle)) {
                    return [$entry];
                }
            }
        }

        return [];
    }

    /**
     * The canonical dish resolution ladder (documented in the class
     * docblock). Returns the lowercase canonical dish or "" when nothing
     * is reliable.
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $mains
     */
    private function canonicalDish(CandidateRecipe $candidate, string $title, array $mains): string
    {
        if (trim($title) === '') {
            return '';
        }

        $cleaned = $this->cleanTitle($title);
        if ($cleaned === '') {
            return '';
        }

        // 1) known-dish alias rewrite (trusted when it fires cleanly).
        [$aliased, $aliasFired] = $this->applyDishAliases($cleaned);
        if ($aliasFired && $aliased !== null && $this->isReliableDish($aliased)) {
            return $aliased;
        }

        // 2) cut descriptive tails ("... with egg and cured pork") and split
        //    dish + form ("chicken alfredo fettuccine" -> "chicken alfredo").
        $candidateDish = $this->cutDescriptiveTail($aliased ?? $cleaned);
        $split = $this->splitDishAndForm($candidateDish);
        if ($split !== null && $this->isReliableDish($split)) {
            return $split;
        }

        // 3) the un-split piece may already be a short reliable dish
        //    ("chicken alfredo", no form word) — but NOT phrases that lead
        //    with a generic family word ("pasta with egg and cured pork"
        //    cuts to "pasta" — unreliable, falls to the recognizer below).
        if ($split === null && $this->isReliableDish($candidateDish)) {
            return $candidateDish;
        }

        // 4) famous-dish recognizer on main ingredients (title was not
        //    conclusive — paraphrased titles converge here).
        $mainNames = $this->normalizer->namesOnly($mains);
        $recognized = $this->recognizeFamousDish($mainNames, $candidate->title);
        if ($recognized !== null) {
            return $recognized;
        }

        return '';
    }

    /**
     * Title cleaning: lowercase, punctuation -> spaces, marketing
     * adjectives + leading flavor words (peeled into markers by the
     * caller-side flavor scan) + quantity words + "recipe" removed.
     */
    private function cleanTitle(string $title): string
    {
        $cleaned = mb_strtolower($title, 'UTF-8');
        // Apostrophes survive ("world's best"), other punctuation -> space.
        $cleaned = (string) preg_replace("/[^\p{L}\p{N}'\s]/u", ' ', $cleaned);
        $cleaned = $this->collapse($cleaned);

        foreach (self::TITLE_MARKETING as $word) {
            $cleaned = $this->removeWordPhrase($cleaned, $word);
        }

        foreach (self::TITLE_QUANTITY_WORDS as $word) {
            $cleaned = $this->removeWordPhrase($cleaned, $word);
        }

        $cleaned = $this->removeWordPhrase($cleaned, 'recipe');
        $cleaned = $this->removeLeadingFlavorWords($cleaned);
        $cleaned = (string) preg_replace('/\s+\bstyle\b\s*/u', ' ', $cleaned); // trailing "... style X"

        return $this->collapse($cleaned);
    }

    /**
     * Peel leading flavor adjectives (they are markers, not identity) and
     * record nothing here — the flavorMarkers() scan re-detects them from
     * the raw title anyway.
     */
    private function removeLeadingFlavorWords(string $text): string
    {
        return $this->collapse(trim((string) preg_replace('/^(?:'.implode('|', array_map(
            fn (string $word): string => preg_quote($word, '/'),
            array_keys(self::TITLE_FLAVOR_WORDS),
        )).')\s+/iu', '', ltrim($text))));
    }

    /**
     * Remove a word/phrase with word boundaries, then collapse spaces and
     * strip dangling connectors ("with and" patterns never occur here
     * because only listed adjectives are removed).
     */
    private function removeWordPhrase(string $text, string $word): string
    {
        return $this->collapse(trim((string) preg_replace('/(^|\s)'.preg_quote($word, '/').'(?=\s|$)/iu', ' ', $text)));
    }

    /**
     * Apply the DISH_ALIASES rewrites (longest keys first for safety).
     * Returns [dish candidate, whether an alias fired] — null dish when the
     * cleaned title was empty. When an alias fires, consecutive duplicate
     * words collapse ("spaghetti carbonara" self-expands to "spaghetti
     * spaghetti carbonara" then collapses back).
     *
     * @return array{0: string|null, 1: bool}
     */
    private function applyDishAliases(string $cleaned): array
    {
        if ($cleaned === '') {
            return [null, false];
        }

        foreach (self::DISH_ALIASES as $alias => $canonical) {
            if (preg_match('/(^|\s)'.preg_quote($alias, '/').'(?=\s|$)/u', $cleaned) === 1) {
                $expanded = preg_replace('/(^|\s)'.preg_quote($alias, '/').'(?=\s|$)/iu', ' '.$canonical.' ', $cleaned);
                $expanded = $this->resolveOriginAdjectives($this->collapseConsecutiveDuplicates($this->collapse(trim((string) $expanded))));
                $expanded = $this->collapse($expanded);

                return [$expanded !== '' ? $expanded : null, true];
            }
        }

        $cleaned = $this->resolveOriginAdjectives($cleaned);
        $cleaned = $this->collapse($cleaned);

        return [$cleaned !== '' ? $cleaned : null, false];
    }

    /**
     * Collapse consecutive duplicate words ("spaghetti spaghetti" ->
     * "spaghetti").
     */
    private function collapseConsecutiveDuplicates(string $text): string
    {
        return trim((string) preg_replace('/\b(\p{L}+)(?:\s+\1)+\b/u', '$1', $text));
    }

    /**
     * Drop origin/country adjectives from candidate dish names (they are
     * cuisine, not dish): "egyptian ful medames" -> "ful medames".
     */
    private function resolveOriginAdjectives(string $text): string
    {
        return $this->collapse(trim((string) preg_replace(
            '/(?:^|\s)(?:'.implode('|', array_map(fn (string $word): string => preg_quote($word, '/'), self::TITLE_ORIGIN_WORDS)).')(?=\s|$)/iu',
            ' ',
            $text,
        )));
    }

    /**
     * Cut descriptive title tails: everything from a "with ..." / "topped
     * ..." phrase onward is preparation detail, not dish identity
     * ("pasta with egg and cured pork" -> "pasta"). "and" is NOT a cut
     * point (real dish names use it: "fish and chips").
     */
    private function cutDescriptiveTail(string $title): string
    {
        $cut = trim((string) preg_split('/\s+\b(?:with|topped|served|in a|from a)\b/iu', $title)[0] ?? $title);

        return $this->collapse($cut);
    }

    /**
     * Split a trailing form word off the dish ("chicken alfredo
     * fettuccine" -> dish "chicken alfredo", the form is carried by
     * identity.form). The remaining dish part must keep at least two words
     * ("chicken fettuccine" does not become "chicken"). Returns the dish
     * part, or null when there is no trailing form word to split.
     */
    private function splitDishAndForm(string $candidateDish): ?string
    {
        $formWords = ['spaghetti', 'fettuccine', 'penne', 'rigatoni', 'farfalle', 'linguine', 'macaroni', 'tagliatelle', 'bucatini', 'lasagna', 'manicotti', 'tortellini', 'tortelloni', 'ravioli', 'orzo', 'couscous', 'gnocchi', 'sandwich', 'wrap', 'smoothie', 'bowl', 'soup', 'salad', 'pie', 'tart', 'cake', 'bread', 'pizza', 'patty', 'parfait', 'skewer', 'kebab', 'noodles', 'pasta'];
        foreach ($formWords as $form) {
            if (preg_match('/^((?:.*\s)?\S+)\s+'.preg_quote($form, '/').'$/u', $candidateDish) === 1) {
                $dish = trim((string) preg_replace('/\s+'.preg_quote($form, '/').'$/u', '', $candidateDish));

                return str_contains($dish, ' ') ? $dish : null;
            }
        }

        return null;
    }

    /**
     * Reliability gate: NOT empty and not LEADING with a generic family
     * word ("pasta with egg and cured pork" is a description, "chicken
     * alfredo" is a dish; a dish genuinely named "pasta e fagioli" stays
     * unreliable by design — an empty canonical dish is always safer than
     * a wrong one).
     */
    private function isReliableDish(string $dish): bool
    {
        $dish = $this->collapse($dish);
        if ($dish === '') {
            return false;
        }

        $words = explode(' ', $dish);

        return ! in_array($words[0], self::GENERIC_DISH_WORDS, true);
    }

    /**
     * The famous-dish recognizer: run ONLY when the title ladder failed.
     * Main names must satisfy every all-group and none of the none-list.
     *
     * @param  list<string>  $mainNames
     */
    private function recognizeFamousDish(array $mainNames, string $rawTitle): ?string
    {
        if ($mainNames === []) {
            return null;
        }

        $haystack = ' '.$this->collapse(mb_strtolower(implode(' | ', $mainNames), 'UTF-8')).' | '.$this->collapse(mb_strtolower(trim($rawTitle), 'UTF-8')).' ';

        foreach (self::FAMOUS_DISHES as $dish) {
            $ok = true;
            foreach ($dish['all'] as $alternatives) {
                $found = false;
                foreach ($alternatives as $needle) {
                    if (preg_match('/(?:^|[^a-z])'.preg_quote((string) $needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                        $found = true;

                        break;
                    }
                }
                if (! $found) {
                    $ok = false;

                    break;
                }
            }

            if (! $ok) {
                continue;
            }

            $clean = true;
            foreach ($dish['none'] as $needle) {
                if (preg_match('/(?:^|[^a-z])'.preg_quote((string) $needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                    $clean = false;

                    break;
                }
            }

            if ($clean) {
                return $dish['dish'];
            }
        }

        return null;
    }

    /**
     * Cuisine with the identity context attached (the heuristic stage sees
     * the main ingredients directly — no half-built identity needed).
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $mains
     */
    private function resolveCuisine(CandidateRecipe $candidate, string $canonicalDish, ?string $dishFamily, array $mains): ?string
    {
        $cuisine = $this->cuisineDetector->detectCuisine($candidate);
        if ($cuisine !== null) {
            return $cuisine;
        }

        // Last resort: signature heuristics against the actual mains,
        // when explicit hints and keywords were inconclusive.
        $haystack = ' '.$this->collapse(mb_strtolower(implode(' | ', $this->normalizer->namesOnly($mains)), 'UTF-8')).' | '.$this->collapse(mb_strtolower(trim($candidate->title), 'UTF-8')).' | '.$this->collapse(mb_strtolower(implode(' | ', $candidate->keywords), 'UTF-8')).' | '.$this->collapse(mb_strtolower((string) $canonicalDish, 'UTF-8')).' ';

        return $this->cuisineDetector->cuisineFromIngredientHaystack($haystack);
    }

    /**
     * The dish family: explicit hint trusted when it names a known family,
     * otherwise the category/title/ingredient ladder (ingredients are the
     * ALREADY normalized set — never normalize twice).
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $ingredients
     */
    private function resolveDishFamily(CandidateRecipe $candidate, array $ingredients): ?string
    {
        return $this->cuisineDetector->resolveDishFamily(
            $candidate->dishFamilyHint,
            $candidate->category,
            $candidate->title,
            $this->normalizer->namesOnly($ingredients),
        );
    }

    /**
     * Conservative flavor markers from title + ingredient names (+ the
     * description/keywords when present): spicy/smoky/sweet/creamy/
     * garlicky/tangy/herby. Only STRONG markers are kept, deduped, sorted.
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $ingredients
     * @return list<string>
     */
    private function flavorMarkers(CandidateRecipe $candidate, string $title, array $ingredients, ?string $dishFamily): array
    {
        $haystack = ' '.$this->collapse(mb_strtolower($title, 'UTF-8')).' | '
            .$this->collapse(mb_strtolower((string) $candidate->description, 'UTF-8')).' | '
            .$this->collapse(mb_strtolower(implode(' | ', $candidate->keywords), 'UTF-8')).' | '
            .$this->collapse(mb_strtolower(implode(' | ', $this->normalizer->namesOnly($ingredients)), 'UTF-8')).' | ';

        $patterns = [
            'spicy' => '/(?:^|[^a-z])(spicy|harissa|gochujang|sriracha|cayenne|chipotle|jalapeno|jalape.o|chili|chilies|habin?ero|hot pepper|شطة|حار)(?:[^a-z]|$)/u',
            'smoky' => '/(?:^|[^a-z])(smoked|chipotle)(?:[^a-z]|$)/u',
            'sweet' => '/(?:^|[^a-z])(candied|حلو)(?:[^a-z]|$)/u',
            'creamy' => '/(?:^|[^a-z])(creamy)(?:[^a-z]|$)/u',
            'garlicky' => '/(?:^|[^a-z])(garlicky)(?:[^a-z]|$)/u',
            'tangy' => '/(?:^|[^a-z])(tangy|zesty)(?:[^a-z]|$)/u',
            'herby' => '/(?:^|[^a-z])(herbed|herby)(?:[^a-z]|$)/u',
        ];

        $markers = [];
        foreach ($patterns as $marker => $pattern) {
            if (preg_match($pattern, $haystack) === 1) {
                $markers[] = $marker;
            }
        }

        // Dessert family is inherently sweet.
        if ($dishFamily === 'dessert') {
            $markers[] = 'sweet';
        }

        $markers = array_values(array_unique($markers));
        sort($markers, SORT_STRING);

        return $markers;
    }

    /**
     * Short derived characteristics from title/category/keyword signals
     * only. sparse_metadata is added ONLY when ingredients were empty
     * entirely (degraded identity — the detection slice re-processes).
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $ingredients
     * @param  list<string>  $flavorMarkers
     * @return list<string>
     */
    private function characteristics(CandidateRecipe $candidate, string $title, bool $ingredientsEmpty, array $flavorMarkers): array
    {
        $haystack = ' '.$this->collapse(mb_strtolower($title, 'UTF-8')).' | '
            .$this->collapse(mb_strtolower(trim((string) $candidate->category), 'UTF-8')).' | '
            .$this->collapse(mb_strtolower(implode(' | ', $candidate->keywords), 'UTF-8')).' | ';

        $characteristics = [];

        if (preg_match('/(?:^|[^a-z])(vegan|نباتي)(?:[^a-z]|$)/u', $haystack) === 1) {
            $characteristics[] = 'vegan';
        }
        if (preg_match('/(?:^|[^a-z])(vegetarian)(?:[^a-z]|$)/u', $haystack) === 1
            && ! in_array('vegan', $characteristics, true)) {
            $characteristics[] = 'vegetarian';
        }
        if (in_array('spicy', $flavorMarkers, true)) {
            $characteristics[] = 'spicy';
        }
        if (preg_match('/(?:^|[^a-z])(one[-\s]?pot|skillet)(?:[^a-z]|$)/u', $haystack) === 1) {
            $characteristics[] = 'one-pot';
        }
        if (preg_match('/(?:^|[^a-z])(oven[-\s]?baked|baked in the oven)(?:[^a-z]|$)/u', $haystack) === 1) {
            $characteristics[] = 'oven-baked';
        }
        if (preg_match('/(?:^|[^a-z])(skinless)(?:[^a-z]|$)/u', $haystack) === 1) {
            $characteristics[] = 'skinless';
        }
        if (preg_match('/(?:^|[^a-z])(boneless)(?:[^a-z]|$)/u', $haystack) === 1) {
            $characteristics[] = 'boneless';
        }
        if ($ingredientsEmpty) {
            $characteristics[] = 'sparse_metadata';
        }

        $characteristics = array_values(array_unique($characteristics));
        sort($characteristics, SORT_STRING);

        return $characteristics;
    }

    private function collapse(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', trim($text)));
    }

    /**
     * @param  list<string>  $items
     * @param  list<string>  $needles
     */
    private function matchesAny(string $item, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle === '') {
                continue;
            }
            if (str_starts_with($item, $needle)
                || str_contains($item, ' '.$needle)) {
                return true;
            }
        }

        return false;
    }
}
