<?php

namespace App\Services\RecipeDedup\Fingerprinting;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * Deterministic cuisine + dish-family detection — no AI, no HTTP.
 *
 * Confidence ladder for cuisine:
 *   1. explicit hint (candidate->cuisineHint, e.g. from the generation brief)
 *   2. category / keywords / description keyword matches against the lexicon
 *   3. signature-ingredient heuristics (rare, high-confidence pairs ONLY)
 *
 * When unsure the detector returns null and NEVER guesses between similar
 * cuisines on common ingredients alone: conflicting signals (e.g. both
 * "italian" and "mexican" keywords) resolve to null, and shared culinary
 * vocabulary like oil/garlic/tomato or plain "pasta" is deliberately NOT a
 * cuisine signal.
 */
final class CuisineDetector
{
    public function __construct() {}

    /**
     * The compact cuisine lexicon (title/keyword matching). Order matters:
     * longer / more specific labels must match before their substrings
     * (italian-american before italian, tex-mex before mex(ican),
     * middle-eastern before ...eastern).
     */
    private const CUISINE_LEXICON = [
        'italian-american' => ['italian-american', 'italian american', 'italo-american'],
        'tex-mex' => ['tex-mex', 'tex mex', 'texmex'],
        'middle-eastern' => ['middle-eastern', 'middle eastern', 'middle eastern'],
        'italian' => ['italian'],
        'mediterranean' => ['mediterranean'],
        'levantine' => ['levantine', 'shami', 'lebanese', 'syrian', 'palestinian', 'jordanian'],
        'egyptian' => ['egyptian', 'مصري'],
        'moroccan' => ['moroccan', 'maghrebi'],
        'tunisian' => ['tunisian'],
        'turkish' => ['turkish', 'turk'],
        'greek' => ['greek'],
        'indian' => ['indian', 'bengali', 'punjabi'],
        'pakistani' => ['pakistani'],
        'chinese' => ['chinese', 'sichuan', 'cantonese'],
        'japanese' => ['japanese', 'sushi'],
        'korean' => ['korean'],
        'thai' => ['thai'],
        'vietnamese' => ['vietnamese'],
        'mexican' => ['mexican'],
        'american' => ['american', 'southern us', 'creole', 'cajun kitchen'],
        'british' => ['british'],
        'french' => ['french'],
        'spanish' => ['spanish', 'tapas'],
        'portuguese' => ['portuguese'],
        'brazilian' => ['brazilian'],
        'russian' => ['russian', 'ukrainian'],
        'ethiopian' => ['ethiopian'],
        'nigerian' => ['nigerian'],
        'filipino' => ['filipino'],
        'indonesian' => ['indonesian', 'balinese'],
    ];

    /**
     * Signature-ingredient heuristics: pairs/groups of ingredients that
     * basically only occur inside one cuisine. Every pattern requires its
     * marker ingredients to be PRESENT (and items in 'not' lists ABSENT);
     * anything weaker stays null (never guess between similar cuisines).
     *
     * For fish sauce + rice the brief mandates the coarse GROUP label
     * "southeast asian" rather than a wrong guess of thai/vietnamese/...
     */
    private const SIGNATURE_HEURISTICS = [
        [
            'cuisine' => 'italian',
            'all' => [['guanciale', 'pancetta', 'pork cheek'], ['pecorino', 'parmesan']],
        ],
        [
            // Fava-bean evidence AND an Egyptian lexeme (ful/foul/melokhia
            // in any spelling) — plain fava bean stew stays null.
            'cuisine' => 'egyptian',
            'all' => [['fava bean', 'fava beans', 'ful', 'foul', 'فول'], ['ful', 'foul', 'فول', 'melokhia', 'molokhia', 'ملوخية']],
        ],
        [
            'cuisine' => 'levantine',
            'any' => ['sumac', 'زا عتر', 'زعتر', "za'atar", 'zaatar'],
        ],
        [
            'cuisine' => 'korean',
            'any' => ['gochujang', 'gochugaru'],
        ],
        [
            'cuisine' => 'japanese',
            'any' => ['miso'],
        ],
        [
            'cuisine' => 'indian',
            'any' => ['garam masala'],
        ],
        [
            'cuisine' => 'tunisian',
            'any' => ['harissa'],
        ],
        [
            'cuisine' => 'moroccan',
            'any' => ['ras el hanout', 'ras el-hanout'],
        ],
        [
            'cuisine' => 'mexican',
            'any' => ['masa harina', 'cotija'],
        ],
        [
            'cuisine' => 'southeast asian',
            'all' => [['fish sauce'], ['rice']],
        ],
    ];

    /**
     * The dish-family keyword ladder. Category first ("Pasta", "Soups",
     * "Breakfast" — how the platform labels rows), then title tokens.
     */
    private const DISH_FAMILY_CATEGORY = [
        'pasta' => ['pasta', 'noodle dish'],
        'breakfast' => ['breakfast', 'brunch'],
        'dessert' => ['dessert', 'sweet', 'baking'],
        'main_dish' => ['main dish', 'main course', 'mains', 'dinner', 'entree'],
        'appetizer' => ['appetizer', 'starter', 'snack', 'side dish', 'sides'],
        'soup' => ['soup', 'soups', 'stew', 'stews', 'broth'],
        'salad' => ['salad', 'salads'],
        'bread' => ['bread', 'breads', 'baked goods', 'pastry', 'pastries'],
        'sauce' => ['sauce', 'sauces', 'condiment', 'condiments', 'dressing', 'dressings'],
        'drink' => ['drink', 'drinks', 'beverage', 'beverages', 'smoothie', 'juice', 'cocktail'],
    ];

    /**
     * Title-driven family rules (regex -> family), evaluated in ladder
     * order — first hit wins. Pasta shapes and named pasta dishes are
     * checked FIRST (a "pasta salad" would otherwise collapse onto salad:
     * accepted trade-off — the form facet carries the shape, the family
     * ladders to pasta; both stay deterministic and documented).
     */
    private const DISH_FAMILY_TITLE = [
        'pasta' => ['spaghetti', 'fettuccine', 'penne', 'rigatoni', 'farfalle', 'linguine', 'macaroni', 'tagliatelle', 'bucatini', 'lasagna', 'manicotti', 'tortellini', 'tortelloni', 'ravioli', 'orzo', 'couscous', 'gnocchi', '\bpasta\b', 'mac and cheese', 'carbonara', 'alfredo'],
        'breakfast' => ['breakfast', 'pancake', 'omelet', 'omelette', 'frittata', 'shakshuka', 'ful', 'foul', 'waffle', 'congee', 'porridge', 'oatmeal'],
        'dessert' => ['cake', 'cheesecake', 'cookie', 'brownie', 'muffin', 'tart', 'ice cream', 'pudding', 'pavlova', 'baklava', 'syrup dessert', 'dessert', 'sweet pastry', 'knafeh', 'basbousa', 'mahalabia', 'rice pudding'],
        'soup' => ['soup', 'stew', 'chowder', 'bisque', 'broth', 'shorba', 'chorba', 'حريرة', 'شوربة'],
        'salad' => ['salad', 'tabbouleh', 'fattoush', 'tzatziki', 'slaw'],
        'bread' => ['bread', 'loaf', 'baguette', 'focaccia', 'pita', 'aish', 'brioche', 'sourdough', 'bagel', 'feteer'],
        'sauce' => ['sauce', 'marinara', 'pesto', 'vinaigrette', 'mayonnaise', 'aioli', 'tzatziki', 'hollandaise', 'salsa', 'chutney', 'hummus', 'mahalabia sauce'],
        'drink' => ['juice', 'smoothie', 'lemonade', 'latte', 'cocktail', 'mocktail', 'sherbet', 'frappe', 'iced tea'],
        'appetizer' => ['dip', 'bruschetta', 'crostini', 'fritters', 'wings', 'skewers', 'mezze', 'antipasto'],
    ];

    /**
     * The family output alphabet (the brief's frozen list).
     */
    private const FAMILIES = [
        'pasta', 'breakfast', 'dessert', 'main_dish', 'appetizer',
        'soup', 'salad', 'bread', 'sauce', 'drink', 'other',
    ];

    /**
     * Detect the cuisine. null when unsure — never a guess.
     */
    public function detectCuisine(CandidateRecipe $candidate, ?CulinaryIdentity $partial = null): ?string
    {
        // 1) explicit hint, normalized into a lexicon label when possible.
        $hint = $this->normalizeCuisineToken($candidate->cuisineHint);
        if ($hint !== null) {
            return $hint;
        }

        // 2) keyword / category / description matches.
        $matches = $this->keywordCuisines($candidate);
        if (count($matches) === 1) {
            return $matches[0];
        }
        // 0 matches -> fall through; 2+ distinct cuisines -> unsolvable
        // conflict on text alone ({it, mx} — null).
        if (count($matches) >= 2) {
            return null;
        }

        // 3) signature ingredients (main-ingredient-aware when available).
        return $this->ingredientHeuristic($candidate, $partial);
    }

    /**
     * The coarse dish family: pasta|breakfast|dessert|main_dish|appetizer|
     * soup|salad|bread|sauce|drink|other|null. Category hints are trusted
     * verbatim when they name a family; otherwise the title (and, weaker,
     * ingredient names) decide; null when nothing matches — "other" is only
     * produced through the ?dishFamilyHint contract, never guessed.
     */
    public function dishFamilyFrom(?string $category, string $title, array $ingredients): ?string
    {
        $categoryWord = $this->singularWord(mb_strtolower(trim((string) ($category ?? '')), 'UTF-8'));
        if ($categoryWord !== '') {
            foreach (self::DISH_FAMILY_CATEGORY as $family => $words) {
                foreach ($words as $word) {
                    if (str_contains($categoryWord, $word)) {
                        return $family;
                    }
                }
            }
        }

        $titleLower = $this->lowerText($title);
        if ($titleLower !== '') {
            foreach (self::DISH_FAMILY_TITLE as $family => $patterns) {
                foreach ($patterns as $pattern) {
                    if (preg_match('/(?:^|[^a-z])'.str_replace('/', '\/', $pattern).'(?:[^a-z]|$)/u', $titleLower) === 1) {
                        return $family;
                    }
                }
            }
        }

        // Weakest signal: pasta-shape ingredient names → pasta family (the
        // title said nothing, ingredients are honest). Everything else is a
        // guess and stays null.
        $ingredientHaystack = ' '.$this->lowerText(implode(' | ', array_map('strval', $ingredients))).' ';
        if (preg_match('/(?:^|\s|\|)(spaghetti|fettuccine|penne|rigatoni|farfalle|linguine|macaroni|tagliatelle|bucatini|lasagna|manicotti|tortellini|tortelloni|ravioli|orzo|gnocchi|pasta)(?:\s|\|| $)/u', $ingredientHaystack) === 1) {
            return 'pasta';
        }

        return null;
    }

    /**
     * The trusted family when the row carries an explicit dishFamilyHint.
     */
    public function resolveDishFamily(?string $hint, ?string $category, string $title, array $ingredients): ?string
    {
        $family = $hint !== null
            ? (in_array(trim(mb_strtolower($hint, 'UTF-8')), self::FAMILIES, true) ? trim(mb_strtolower($hint, 'UTF-8')) : null)
            : null;

        return $family ?? $this->dishFamilyFrom($category, $title, $ingredients);
    }

    /**
     * Keyword/category/description cuisine matches (distinct, lexicon order).
     *
     * @return list<string>
     */
    private function keywordCuisines(CandidateRecipe $candidate): array
    {
        $haystack = $this->lowerText(implode(' | ', [
            (string) $candidate->category,
            implode(' | ', $candidate->keywords),
            (string) $candidate->description,
        ]));

        $matches = [];
        foreach (self::CUISINE_LEXICON as $cuisine => $needles) {
            foreach ($needles as $needle) {
                if (preg_match('/(?:^|[^a-z])'.preg_quote($needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                    $matches[] = $cuisine;

                    break;
                }
            }
        }

        return array_values(array_unique($matches));
    }

    /**
     * The CuisineDetector's own signature checks extracted so the identity
     * extractor can feed a haystack that includes the main ingredients and
     * canonical dish context (a stronger signal than raw lines alone).
     */
    public function cuisineFromIngredientHaystack(string $haystack): ?string
    {
        $haystack = ' '.trim((string) preg_replace('/\s+/u', ' ', mb_strtolower(trim($haystack), 'UTF-8'))).' ';

        $first = null;
        foreach (self::SIGNATURE_HEURISTICS as $heuristic) {
            if (isset($heuristic['all'])) {
                $all = true;
                foreach ($heuristic['all'] as $alternatives) {
                    if (! $this->hasAny($alternatives, $haystack)) {
                        $all = false;

                        break;
                    }
                }
                if ($all) {
                    if ($first !== null && $first !== $heuristic['cuisine']) {
                        return null; // conflicting signatures — never guess
                    }
                    $first ??= $heuristic['cuisine'];
                }
            }

            if (isset($heuristic['any']) && $this->hasAny($heuristic['any'], $haystack)) {
                if ($first !== null && $first !== $heuristic['cuisine']) {
                    return null;
                }
                $first ??= $heuristic['cuisine'];
            }
        }

        return $first;
    }

    /**
     * Signature-ingredient heuristics on the normalized ingredient set
     * (falls back to raw lines + title when no identity exists yet).
     */
    private function ingredientHeuristic(CandidateRecipe $candidate, ?CulinaryIdentity $partial): ?string
    {
        $normalizer = new IngredientNormalizer;
        if ($partial !== null) {
            $names = [...$partial->mainIngredientNames(), ...$partial->allIngredientNames()];
        } else {
            $names = $normalizer->namesOnly($normalizer->set(
                $candidate->ingredientsStructured !== [] ? $candidate->ingredientsStructured : $candidate->ingredientsRaw,
            ));
        }

        $haystack = ' '.$this->lowerText(implode(' | ', $names)).' | '.$this->lowerText($candidate->title).' ';

        return $this->cuisineFromIngredientHaystack($haystack);
    }

    /**
     * @param  list<string>  $needles
     */
    private function hasAny(array $needles, string $haystack): bool
    {
        foreach ($needles as $needle) {
            if (preg_match('/(?:^|[^a-z])'.preg_quote((string) $needle, '/').'(?:[^a-z]|$)/u', $haystack) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Map a free-form hint ("Italian", "italian american") to a lexicon
     * label; unknown hints are NOT trusted.
     */
    private function normalizeCuisineToken(?string $token): ?string
    {
        $value = trim(mb_strtolower(trim((string) ($token ?? '')), 'UTF-8'));
        if ($value === '') {
            return null;
        }
        $value = (string) preg_replace('/[\s_]+/u', '-', $value);

        if (in_array($value, array_keys(self::CUISINE_LEXICON), true)) {
            return $value;
        }

        foreach (self::CUISINE_LEXICON as $cuisine => $needles) {
            if (in_array($value, $needles, true)) {
                return $cuisine;
            }
        }

        return null;
    }

    private function lowerText(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', mb_strtolower(trim($text), 'UTF-8')));
    }

    private function singularWord(string $text): string
    {
        return $this->lowerText($text);
    }
}
