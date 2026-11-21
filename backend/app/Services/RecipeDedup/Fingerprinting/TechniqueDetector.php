<?php

namespace App\Services\RecipeDedup\Fingerprinting;

/**
 * Deterministic technique/method/sauce/form detection from recipe TEXT
 * (steps, title, ingredient names) — no AI, no HTTP.
 *
 * Steps are matched against a fixed lexicon of canonical technique CLASSES
 * (regex-driven, whole-word). The classes are the vocabulary every other
 * slice relies on, so the lexicon maps onto the frozen core set used by the
 * identity signature (see CORE_TECHNIQUES).
 *
 * A SMALL Arabic verb lexicon buys reliability cheaply for AR drafts: the
 * handful of highest-signal cooking verbs is matched after stripping tashkeel
 * (diacritics); everything else falls through untouched.
 *
 * IMPORTANT semantic note (documented + tested): carbonara has NO cream. The
 * egg+pecorino "sauce" is an emulsion, so carbonara-class dishes come back
 * with no sauce type at all — when unsure, saucesFrom() returns []. cream
 * detection keys on actual cream ingredients (heavy/whipping/double cream,
 * coconut cream, cream cheese), never on the word "creamy" in a description.
 */
final class TechniqueDetector
{
    /**
     * Technique classes -> whole-word regex fragments. Additive constants
     * only; each entry must stay one canonical class. "fry" is matched with
     * deep-fry tokens stripped out of the line first so deep frying never
     * counts as saute (SAUTE_EXCLUDES guards it). "render" counts as saute
     * because rendering fat happens in a pan; the "in a pan/skillet" phrase
     * is a deliberate rewording-proof signal (the modifier slot only allows
     * size adjectives, so "baking pan"/"roasting pan" can never match).
     */
    private const LEXICON = [
        'saute' => ['saut(?:e|é)', 'fry|fries|fried|frying', 'pan[-\s]?fry\w*', 'brown(?:s|ed|ing)?', 'sear(?:e|s|ed|ing)?', 'stir[-\s]?fry\w*', 'render(?:s|ed|ing)?', 'in (?:a|the) (?:large |big |small |heavy |dry |hot )?(?:pan|skillet)\\b'],
        'deep_fry' => ['deep[-\s]?fry\w*'],
        'boil' => ['boil\w*', 'blanch\w*', 'parboil\w*'],
        'simmer' => ['simmer\w*'],
        'poach' => ['poach\w*'],
        'bake' => ['bak(?:e|es|ed|ing)', 'oven[-\s]?bake'],
        'roast' => ['roast\w*'],
        'grill' => ['grill\w*'],
        'broil' => ['broil\w*'],
        'steam' => ['steam\w*'],
        'braise' => ['brais\w*'],
        'marinate' => ['marinat\w*', 'soak(?:s|ed|ing)? in\b'],
        'chill' => ['chill\w*', 'refrigerat\w*'],
        'freeze' => ['freez\w*'],
        'blend' => ['blend\w*', 'pur(?:ee|é|e\b)', 'food processor', 'liquidis\w*'],
        'whip' => ['whip\w*', '\bbeat(?:s|en|ing)?\b'],
        'whisk' => ['whisk\w*'],
        'knead' => ['knead\w*'],
        'ferment' => ['ferment\w*', '\brise(?:s|n)?\b', 'proof\w*'],
        'toss' => ['toss\w*'],
        'pickle' => ['pickl\w*'],
        'smoke' => ['smok(?:e|es|ed|ing)'], // step text: "smoke the brisket" — ingredient strings are NOT scanned here
        'brine' => ['brine\w*'],            // "brine"/"brined"/"brining" — must NOT match the verb "bring"
        'reduce' => ['reduc\w*'],
        'rest' => ['(?:let|allow)[^.]{0,40}\brest\b', '\brest(?:s|ing)?\s+(?:the\s)?(?:\w+\s)?(?:dough|meat|steak|chicken|beef|pork|lamb|fish|rice|pasta|brisket)\b', '\brest(?:s|ing)?\b[^.]{0,15}\b(?:before|for|at room)'],
        'assemble' => ['assembl\w*'],
        'emulsify' => ['emulsif\w*'],
        'temper' => ['\btemper(?:s|ed|ing)?\b'], // "temperature" does NOT match
        'deglaze' => ['deglaz\w*'],
    ];

    /**
     * Technique classes that involve DIRECT HEAT, in dominance priority
     * (the first class present wins as the cooking method):
     * deep_fry > saute > grill > roast > bake > simmer > boil > poach >
     * steam > braise. (braise is slow oven/stovetop braising — arguably the
     * "gentlest" heat; placed last per the brief's ordering.)
     */
    private const COOKING_METHOD_PRIORITY = [
        'deep_fry', 'saute', 'grill', 'roast', 'bake',
        'simmer', 'boil', 'poach', 'steam', 'braise',
    ];

    /** Arabic verb lexicon (small, high-signal only), matched after tashkeel strip. */
    private const ARABIC_LEXICON = [
        'saute' => ['يقلي', 'قُلِي', 'يُقلى', 'اقلي'],
        'bake' => ['يخبز', 'يُخبز', 'اخبز'],
        'boil' => ['يغلي', 'يُغلي', 'سلق', 'اسلق'],
        'simmer' => ['على نار هادئة', 'على نار خفيفة'],
        'grill' => ['يشوي', 'يُشوى', 'شوي', 'اسوي'],
        'steam' => ['على البخار', 'يُبخر'],
        'marinate' => ['يتبل', 'يُتبل', 'تتبيلة'],
        'blend' => ['يخلط في الخلاط', 'الخلاط', 'يهرس'],
        'whip' => ['يخفق', 'يُخفق'],
        'knead' => ['يعجن', 'يُعجن'],
        'chill' => ['يبرد', 'يُبرد', 'في الثلاجة'],
        'freeze' => ['يجمد', 'يُجمد'],
    ];

    /**
     * The CORE technique set used in identity signatures (the brief's frozen
     * list). Whisk/toss/marinate/chill/freeze/rest/assemble/temper/deglaze
     * are real detection classes but deliberately NOT signature-bearing:
     * they vary between wording styles of the SAME dish ("whisk" vs "mix…
     * to a paste") and would split identical otherwise-identical recipes.
     */
    public const CORE_TECHNIQUES = [
        'saute', 'deep_fry', 'boil', 'simmer', 'poach', 'bake', 'roast', 'grill',
        'broil', 'steam', 'braise', 'blend', 'whip', 'knead', 'ferment',
        'pickle', 'smoke', 'brine', 'reduce', 'emulsify',
    ];

    /** prepMethodFrom() priority (first present wins). */
    private const PREP_METHOD_MAP = [
        'blend' => 'blended',
        'marinate' => 'marinated',
        'assemble' => 'assembled',
        'knead' => 'kneaded',
        'whip' => 'whipped',
        'pickle' => 'pickled',
        'ferment' => 'fermented',
    ];

    /**
     * Pasta shapes for form detection — searched with priority over every
     * other form (a pasta recipe's shape IS its form). "tortellini" is its
     * own form; "ravioli"/"raviolo" collapse to ravioli.
     */
    private const PASTA_FORMS = [
        'spaghetti', 'fettuccine', 'penne', 'rigatoni', 'farfalle', 'linguine',
        'macaroni', 'tagliatelle', 'bucatini', 'lasagna', 'manicotti',
        'tortellini', 'tortelloni', 'ravioli', 'raviolo', 'orzo', 'couscous', 'gnocchi',
    ];

    /** Other detectable forms (searched after the pasta shapes). */
    private const OTHER_FORMS = [
        'whole_fish' => ['whole fish', 'whole-fish', 'سمكة كاملة'],
        'pancakes' => ['pancake', 'hotcake'],
        'smoothie' => ['smoothie'],
        'sandwich' => ['sandwich', 'burger'],
        'omelet' => ['omelet', 'omelette', 'frittata'],
        'quinoa' => ['quinoa'],
        'porridge' => ['porridge', 'oatmeal bowl'],
        'waffles' => ['waffle'],
        'muffin' => ['muffin'],
        'couscous' => [],
        'custard' => ['custard', 'flan', 'crème brûlée', 'creme brulee'],
        'wrap' => ['wrap', 'shawarma', 'burrito', 'shish tawook sandwich'],
        'pastry' => ['pastry', 'strudel', 'croissant', 'feteer'],
        'dough' => ['dough', 'yeast dough'],
        'layers' => ['layer', 'parfait', 'trifle'],
        'rice' => ['rice', 'روز', 'رز'],
        'patty' => ['patty', 'kofta', 'kebab', 'falafel', 'meatball', 'meat ball'],
        'soup' => ['soup', 'شوربة', 'حساء', 'stew', 'chowder', 'bisque'],
        'salad' => ['salad', 'فسلطة', 'سلطة'],
        'bread' => ['bread', 'roll', 'baguette', 'brioche', 'sourdough', 'focaccia', 'pita', 'aish baladi'],
        'cake' => ['cake', 'cheesecake', 'brownie'],
        'cookie' => ['cookie', 'biscuit'],
        'tart' => ['tart', 'galette'],
        'pie' => ['pie', 'quiche'],
        'pizza' => ['pizza'],
        'drink' => ['juice', 'smoothie', 'lemonade', 'cocktail', 'mocktail', 'latte', 'tea', 'sherbet drink'],
        'bowl' => ['bowl', 'poke'],
    ];

    /** Words that mark a creamy SAUCE base (title/ingredient names only). */
    private const CREAM_MARKERS = ['heavy cream', 'whipping cream', 'double cream', 'coconut cream', 'cream cheese', 'clotted cream', 'سعادة القشطة', 'قشطة', 'كريمة'];

    /** Words that mark a tomato SAUCE base. */
    private const TOMATO_MARKERS = ['tomato', 'passata', 'marinara', 'pomodoro', 'san marzano', 'صلصة', 'طماطم'];

    private const PESTO_MARKERS = ['pesto'];

    private const VINAIGRETTE_MARKERS = ['vinaigrette'];

    private const BROTH_MARKERS = ['stock', 'broth', 'دجاج مرق', 'مرق'];

    private const GRAVY_MARKERS = ['gravy'];

    private const SOY_MARKERS = ['soy sauce', 'tamari', 'shoyu', 'soya', 'صويا'];

    private const CURRY_MARKERS = ['curry powder', 'curry paste', 'curry roux', 'كاري'];

    private const CHOCOLATE_MARKERS = ['cocoa', 'chocolate', 'ganache', 'شوكولاتة'];

    private const CUSTARD_MARKERS = ['custard', 'crème pâtissière', 'creme patissiere', 'flan'];

    private const GLAZE_MARKERS = ['glaze', 'glazed'];

    private const BRAISING_MARKERS = ['braising liquid', 'braised in', 'braising'];

    public function __construct() {}

    /**
     * All canonical technique classes that appear across the given steps.
     * Deduped and sorted — a technique is a SET property of a recipe.
     *
     * @param  list<string>  $steps
     * @return list<string>
     */
    public function techniquesFromSteps(array $steps): array
    {
        $techniques = [];
        foreach ($steps as $step) {
            if (! is_string($step) || trim($step) === '') {
                continue;
            }

            $lower = $this->lowered($step);
            foreach (self::LEXICON as $class => $fragments) {
                if ($this->matchesFragment($class, $fragments, $lower)) {
                    $techniques[$class] = true;
                }
            }

            foreach (self::ARABIC_LEXICON as $class => $needles) {
                // Arabic lexicon is additive: English classes above may
                // already have fired; this only ADDS hits.
                foreach ($needles as $needle) {
                    if (mb_strpos($lower, $needle) !== false) {
                        $techniques[$class] = true;

                        break;
                    }
                }
            }
        }

        $list = array_keys($techniques);
        sort($list, SORT_STRING);

        return $list;
    }

    /**
     * The dominant HEAT technique as the cooking method — first class in
     * COOKING_METHOD_PRIORITY that is present, null when no heat class was
     * detected (chill/freeze/rest/blends are not heat).
     *
     * @param  list<string>  $techniques
     */
    public function cookingMethodFrom(array $techniques): ?string
    {
        foreach (self::COOKING_METHOD_PRIORITY as $class) {
            if (in_array($class, $techniques, true)) {
                return $class;
            }
        }

        return null;
    }

    /**
     * The dominant PREPARATION method from the technique set, in the mapped
     * priority; null when none of blended|marinated|assembled|kneaded|
     * whipped|pickled|fermented applies.
     *
     * @param  list<string>  $techniques
     */
    public function prepMethodFrom(array $techniques): ?string
    {
        foreach (self::PREP_METHOD_MAP as $class => $prep) {
            if (in_array($class, $techniques, true)) {
                return $prep;
            }
        }

        return null;
    }

    /**
     * The CORE technique classes present (frozen identity-signature set).
     *
     * @param  list<string>  $techniques
     * @return list<string>
     */
    public function coreTechniquesFrom(array $techniques): array
    {
        $core = array_values(array_intersect(self::CORE_TECHNIQUES, $techniques));
        sort($core, SORT_STRING);

        return $core;
    }

    /**
     * Sauce-type detection from the title, normalized ingredient NAMES, and
     * the raw step text. Returns every type matched, sorted; [] means no
     * confident sauce ("none" in the brief). Scans ingredients by NAME (not
     * raw line or description) to keep descriptions from leaking in.
     *
     * @param  list<string>  $ingredients  normalized ingredient names
     * @param  list<string>  $steps
     * @return list<string>
     */
    public function saucesFrom(string $title, array $ingredients, array $steps): array
    {
        $haystackIngredients = ' '.$this->lowered(implode(' | ', $ingredients)).' ';
        $haystackSteps = ' '.$this->lowered(implode(' ', $steps)).' ';
        $haystackTitle = ' '.$this->lowered($title).' ';

        $sauces = [];

        // Pesto: title says pesto, or basil + a nut/seed base in ingredients.
        if ($this->hasPhrase(self::PESTO_MARKERS, $haystackTitle)
            || (str_contains($haystackIngredients, ' basil ')
                && preg_match('/(pine nut|walnut|almond|cashew|pistachio|sunflower seed|pumpkin seed)/', $haystackIngredients) === 1)) {
            $sauces[] = 'pesto';
        }

        // Cream-based: REAL cream ingredients only — eggs+cheese emulsions
        // (carbonara) never match, and "creamy" wording alone is not enough.
        if ($this->hasPhrase(self::CREAM_MARKERS, $haystackIngredients)) {
            $sauces[] = 'cream_based';
        }

        if ($this->hasPhrase(self::TOMATO_MARKERS, $haystackIngredients) || $this->hasPhrase(self::TOMATO_MARKERS, $haystackTitle)) {
            $sauces[] = 'tomato';
        }

        if ($this->hasPhrase(self::VINAIGRETTE_MARKERS, $haystackTitle)
            || (str_contains($haystackSteps, ' whisk ')
                && str_contains($haystackSteps, ' oil ')
                && (str_contains($haystackSteps, ' lemon juice')
                    || str_contains($haystackSteps, ' vinegar')
                    || str_contains($haystackSteps, ' lemon ')))) {
            $sauces[] = 'vinaigrette';
        }

        if ($this->hasPhrase(self::BROTH_MARKERS, $haystackIngredients)) {
            $sauces[] = 'broth';
        }

        if ($this->hasPhrase(self::GRAVY_MARKERS, $haystackTitle.$haystackIngredients.$haystackSteps)) {
            $sauces[] = 'gravy';
        }

        if ($this->hasPhrase(self::SOY_MARKERS, $haystackIngredients)) {
            $sauces[] = 'soy_based';
        }

        if ($this->hasPhrase(self::CURRY_MARKERS, $haystackIngredients)
            || (str_contains($haystackTitle, 'curry') && str_contains($haystackIngredients, ' coconut milk'))) {
            $sauces[] = 'curry_based';
        }

        if ($this->hasPhrase(self::CHOCOLATE_MARKERS, $haystackIngredients)
            || $this->hasPhrase(self::CHOCOLATE_MARKERS, $haystackTitle)) {
            $sauces[] = 'chocolate';
        }

        if ($this->hasPhrase(self::CUSTARD_MARKERS, $haystackIngredients)
            || $this->hasPhrase(['custard'], $haystackTitle)) {
            $sauces[] = 'custard';
        }

        if ($this->hasPhrase(self::GLAZE_MARKERS, $haystackTitle)
            || $this->hasPhrase(self::GLAZE_MARKERS, $haystackSteps)) {
            $sauces[] = 'glaze';
        }

        if ($this->hasPhrase(self::BRAISING_MARKERS, $haystackTitle.$haystackSteps)
            || (in_array('braise', $this->techniquesFromSteps($steps), true)
                && $this->hasPhrase(['stock', 'broth', 'wine'], $haystackIngredients))) {
            $sauces[] = 'braising_liquid';
        }

        // Cooking fat: the "sauce" is really the frying medium — only when a
        // fat ingredient exists and NO other sauce type matched. Rendering
        // guanciale (carbonara) does NOT hit this: there is no oil/butter/
        // ghee ingredient, so carbonara stays sauce-less ("none"), which the
        // brief explicitly wants.
        if ($sauces === []
            && $this->hasPhrase(['olive oil', 'vegetable oil', 'butter', 'ghee', 'sunflower oil', 'canola oil'], $haystackIngredients)
            && preg_match('/(fry|fries|fried|frying|saute|sear)/', $haystackSteps) === 1) {
            $sauces[] = 'cooking_fat';
        }

        $sauces = array_values(array_unique($sauces));
        sort($sauces, SORT_STRING);

        return $sauces;
    }

    /**
     * The food FORM: pasta shapes first (a pasta recipe's shape IS its
     * form), then the other form dictionary. Title wins over ingredients.
     * Null when nothing matches.
     *
     * @param  list<string>  $ingredients  normalized ingredient names
     */
    public function formFrom(string $title, array $ingredients, ?string $dishFamily): ?string
    {
        $titleHaystack = ' '.$this->lowered($title).' ';
        $ingredientHaystack = ' '.$this->lowered(implode(' | ', $ingredients)).' ';

        // 1) pasta shapes, title first then ingredients ("raviolo" -> ravioli).
        foreach ([$titleHaystack, $ingredientHaystack] as $haystack) {
            $form = $this->pastaForm($haystack);
            if ($form !== null) {
                return $form;
            }
        }

        // 2) other forms, title first then ingredients.
        foreach ([$titleHaystack, $ingredientHaystack] as $haystack) {
            $form = $this->otherForm($haystack);
            if ($form !== null) {
                return $form;
            }
        }

        return null;
    }

    /**
     * @return list<string> the canonical class names (sorted)
     */
    public function knownTechniqueClasses(): array
    {
        $classes = array_keys(self::LEXICON);
        sort($classes, SORT_STRING);

        return $classes;
    }

    /**
     * @param  list<string>  $fragments
     */
    private function matchesFragment(string $class, array $fragments, string $lower): bool
    {
        if ($class === 'saute') {
            // Raw "fry" must not double-count deep frying, and the nouns
            // "brown sugar"/"brown rice" must not read as the VERB "brown".
            $lower = (string) preg_replace('/deep[-\s]?fry\w*|\bbrown\s+(?:sugar|rice)\b/u', ' ', $lower);
        }

        foreach ($fragments as $fragment) {
            if (preg_match('/(?:^|[^a-z])('.$fragment.')(?:[^a-z]|$)/u', $lower) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $needles  multi-word phrases, matched with
     *                                 non-letter boundary padding
     */
    private function hasPhrase(array $needles, string $haystack): bool
    {
        foreach ($needles as $needle) {
            if (preg_match('/(?:^|[^a-z])'.preg_quote($needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                return true;
            }
        }

        return false;
    }

    private function lowered(string $text): string
    {
        $lower = mb_strtolower(trim($text), 'UTF-8');

        // Strip tashkeel/diacritics so Arabic verbs match reliably.
        $lower = (string) preg_replace('/[\x{064B}-\x{065F}\x{0670}]/u', '', $lower);

        // Normalize apostrophes so za'atar-style tokens match in any quoting.
        $lower = str_replace(['’', '‘', '`'], "'", $lower);

        return (string) preg_replace('/\s+/u', ' ', $lower);
    }

    private function pastaForm(string $haystack): ?string
    {
        foreach (self::PASTA_FORMS as $shape) {
            if (preg_match('/(?:^|[^a-z])'.preg_quote($shape, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                return $shape !== 'raviolo' ? $shape : 'ravioli';
            }
        }

        return null;
    }

    private function otherForm(string $haystack): ?string
    {
        foreach (self::OTHER_FORMS as $form => $needles) {
            if ($needles === []) {
                continue;
            }
            foreach ($needles as $needle) {
                if (preg_match('/(?:^|[^a-z])'.preg_quote($needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                    return $form;
                }
            }
        }

        return null;
    }
}
