<?php

namespace App\Services\RecipeDedup\Fingerprinting;

/**
 * Deterministic ingredient normalization for the fingerprinting slice.
 *
 * Accepts raw lines ("1/4 cup brown sugar, packed"), structured Stage A
 * items ({item, qty, unit, raw, prep} — the recipereal:normalize-ingredients
 * shape), or a mix of both, and produces the canonical fingerprint item
 * shape {item, qty, unit, raw} where:
 *
 *  - item  is a lowercased, singular, synonym-resolved ingredient NAME with
 *          leading size/freshness descriptors and trailing prep phrases
 *          stripped;
 *  - qty   is a float (vulgar fractions and mixed numbers resolved), or null
 *          for "to taste"/"as needed" style measures;
 *  - unit  is a canonical unit CLASS: "gram" | "ml" | "count" | null, or the
 *          original untouched unit string when it maps to no class.
 *
 * Unit classes deliberately DO NOT convert mass<->volume (no density
 * knowledge); spoon measures become ml. Every conversion constant below is a
 * documented approximation that MUST stay stable: fingerprints are persisted
 * hashes, so silently changing one breaks exact matching until a
 * re-extraction (CulinaryIdentity::VERSION bump).
 *
 * The synonym map is ADDITIVE — it must NEVER grow an entry that equates
 * genuinely different ingredients (e.g. plain vs greek yogurt, which the
 * brief declares unmergeable). Entries cover only spelling/regional
 * variants of the same food plus tightly-audited part-whole merges
 * ("egg yolk(s)" -> egg, "garlic clove(s)" -> garlic + count unit).
 *
 * All steps are UTF-8 safe and Arabic input never crashes: non-latin names
 * fall back to a lowercased/trimmed pass-through name.
 */
final class IngredientNormalizer
{
    /**
     * Unicode vulgar fractions -> numeric value (superset of the Stage A set;
     * the thirds/sixths round to 3 decimals so JSON stays stable).
     */
    private const UNICODE_FRACTIONS = [
        '½' => 0.5, '¼' => 0.25, '¾' => 0.75, '⅛' => 0.125,
        '⅜' => 0.375, '⅝' => 0.625, '⅞' => 0.875,
        '⅓' => 0.333, '⅔' => 0.667, '⅙' => 0.167, '⅚' => 0.833,
    ];

    /**
     * Words leading an ingredient that describe size/freshness/processing —
     * never variety. "green", "black", "sweet", "sour" and friends are
     * deliberately ABSENT (they change what the ingredient IS). "dried"/"dry"
     * and the grind adverbs ("coarsely", "finely") plus "crushed"/"whole" are
     * included because they describe processing form, not identity — and the
     * brief's own synonym map folds "wheat flour" onto all-purpose flour.
     */
    private const LEADING_DESCRIPTORS = [
        'fresh', 'freshly', 'raw', 'ripe', 'organic', 'large', 'medium', 'small',
        'boneless', 'skinless', 'dried', 'dry', 'coarsely', 'finely', 'crushed', 'whole',
    ];

    /**
     * The additive SYNONYM map. Keys are phrase matches against the whole
     * normalized name (exact match, or the mapped phrase as the name's tail —
     * e.g. "minced /garlic cloves/" -> garlic). Values are the canonical
     * names as written by the brief; they bypass singularization so each food
     * has exactly ONE canonical string. INVARIANT: no entry may ever equate
     * two genuinely different foods; plain vs greek yogurt is intentionally
     * unmergable, and pecorino stays distinct from parmesan (sheep vs cow).
     */
    private const SYNONYMS = [
        'parmesan' => 'parmesan cheese',
        'parmigiano reggiano' => 'parmesan cheese',
        'parmigiano-reggiano' => 'parmesan cheese',
        'extra virgin olive oil' => 'olive oil',
        'extra-virgin olive oil' => 'olive oil',
        'evoo' => 'olive oil',
        'ground black pepper' => 'black pepper',
        'freshly ground black pepper' => 'black pepper',
        'black peppercorns' => 'black pepper',
        // Herb "leaf/leaves" spellings must equal the bare herb name, or the
        // garnishe/classifier lookups ("basil", "mint") would miss them.
        'basil leaves' => 'basil',
        'basil leaf' => 'basil',
        'parsley leaves' => 'parsley',
        'parsley leaf' => 'parsley',
        'mint leaves' => 'mint',
        'mint leaf' => 'mint',
        'chicken breast fillet' => 'chicken breast',
        'chicken breast filet' => 'chicken breast',
        'chicken breasts' => 'chicken breast',
        'chicken breast meat' => 'chicken breast',
        'green onion' => 'scallion',
        'green onions' => 'scallion',
        'coriander leaves' => 'cilantro',
        'coriander leaf' => 'cilantro',
        'aubergine' => 'eggplant',
        'courgette' => 'zucchini',
        'capsicum' => 'bell pepper',
        'sweet pepper' => 'bell pepper',
        'celery stalks' => 'celery',
        'celery rib' => 'celery',
        'celery ribs' => 'celery',
        'garlic clove' => 'garlic',
        'garlic cloves' => 'garlic',
        'kosher salt' => 'salt',
        'sea salt' => 'salt',
        'table salt' => 'salt',
        'bittersweet chocolate' => 'dark chocolate',
        'heavy whipping cream' => 'heavy cream',
        'double cream' => 'heavy cream',
        'wheat flour' => 'all-purpose flour',
        'all purpose flour' => 'all-purpose flour', // hyphenless spelling
        'ful' => 'fava beans',                      // Egyptian term (فول)
        'foul' => 'fava beans',                     // transliteration variant
        'fava bean' => 'fava beans',                // singular spelling converges up
        'fava beans' => 'fava beans',               // canonical as written by the brief
        'egg yolk' => 'egg',       // part-whole merge: yolk is still egg
        'egg yolks' => 'egg',
        'spaghetti pasta' => 'spaghetti',
        'pecorino romano' => 'pecorino cheese',
        'pecorino cheese' => 'pecorino cheese',
        'romano cheese' => 'pecorino cheese',
    ];

    /**
     * Unit-word -> grams per unit for MASS units mapped to the "gram" class.
     * Frozen approximations: 1 lb = 454 g, 1 oz = 28 g, 1 kg = 1000 g,
     * gram-family = 1. "fl oz" never lands here — it matches as volume first.
     */
    private const MASS_UNITS = [
        'g' => 1.0, 'gram' => 1.0, 'grams' => 1.0, 'gm' => 1.0, 'gr' => 1.0,
        'kg' => 1000.0, 'kilogram' => 1000.0, 'kilograms' => 1000.0, 'kilo' => 1000.0,
        'lb' => 454.0, 'lbs' => 454.0, 'pound' => 454.0, 'pounds' => 454.0,
        'oz' => 28.0, 'ounce' => 28.0, 'ounces' => 28.0,
    ];

    /**
     * Unit-word -> ml per unit for VOLUME units mapped to the "ml" class.
     * Frozen approximations: cup = 240, tbsp = 15, tsp = 5, fl oz = 30,
     * quart = 950, pint = 470, liter = 1000, gallon = 3785.
     */
    private const VOLUME_UNITS = [
        'ml' => 1.0, 'milliliter' => 1.0, 'millilitre' => 1.0, 'milliliters' => 1.0, 'millilitres' => 1.0, 'cc' => 1.0,
        'c' => 240.0, 'cup' => 240.0, 'cups' => 240.0,
        'tbsp' => 15.0, 'tbs' => 15.0, 'tablespoon' => 15.0, 'tablespoons' => 15.0,
        'tsp' => 5.0, 'teaspoon' => 5.0, 'teaspoons' => 5.0,
        'fl oz' => 30.0, 'fl. oz' => 30.0, 'fluid oz' => 30.0, 'fluid ounce' => 30.0, 'fluid ounces' => 30.0,
        'quart' => 950.0, 'quarts' => 950.0,
        'pint' => 470.0, 'pints' => 470.0,
        'l' => 1000.0, 'liter' => 1000.0, 'liters' => 1000.0, 'litre' => 1000.0, 'litres' => 1000.0,
        'gallon' => 3785.0, 'gallons' => 3785.0,
    ];

    /**
     * Counting unit words -> the "count" class. No conversion: the quantity
     * is how many of them there are ("3 cloves garlic" -> qty 3, unit count,
     * item garlic after the clove synonym). "whole" is deliberately absent —
     * it is a leading descriptor, not a unit.
     */
    private const COUNT_UNITS = [
        'clove', 'cloves', 'slice', 'slices', 'can', 'cans', 'piece', 'pieces',
        'sprig', 'sprigs', 'stalk', 'stalks', 'bunch', 'bunches', 'head', 'heads',
        'leaf', 'leaves', 'stick', 'sticks', 'pinch', 'pinches', 'dash', 'drop', 'drops',
        'strip', 'strips', 'pack', 'packet', 'packets', 'package', 'packages',
        'envelope', 'envelopes', 'box', 'boxes', 'jar', 'jars', 'fillet', 'fillets',
    ];

    /**
     * The irregular plural -> singular forms (tested explicitly).
     */
    private const IRREGULAR_PLURALS = [
        'tomatoes' => 'tomato', 'potatoes' => 'potato', 'berries' => 'berry',
        'knives' => 'knife', 'leaves' => 'leaf', 'loaves' => 'loaf',
        'gingers' => 'ginger', 'eggs' => 'egg', 'chiles' => 'chili',
        'chillies' => 'chili', 'chilis' => 'chili', 'chilies' => 'chili',
    ];

    /** Singularization never applies to these words (they end in s already). */
    private const NEVER_SINGULAR = ['molasses', 'swiss', 'couscous', 'bolognese', 'molokhia', 'bashamas'];

    public function __construct() {}

    /**
     * Normalize one raw ingredient line ("1/4 cup brown sugar, packed").
     *
     * @return array{item: string, qty: float|null, unit: string|null, raw: string}
     */
    public function normalize(string $rawLine): array
    {
        return $this->parseRawLine((string) $rawLine);
    }

    /**
     * Normalize one structured Stage A item {item, qty, unit, raw, prep}
     * (reusing its UNIT_ALIASES semantics). When the item field is empty the
     * parser falls back to the raw line.
     *
     * @param  array<string, mixed>  $item
     * @return array{item: string, qty: float|null, unit: string|null, raw: string}
     */
    public function normalizeStructuredItem(array $item): array
    {
        $name = trim((string) ($item['item'] ?? ''));
        $raw = trim((string) ($item['raw'] ?? ''));

        if ($name === '') {
            // Structured item came through with no item — parse the raw text.
            if ($raw === '') {
                return ['item' => '', 'qty' => null, 'unit' => null, 'raw' => ''];
            }

            return $this->parseRawLine($raw);
        }

        $qty = isset($item['qty']) && is_numeric($item['qty']) ? (float) $item['qty'] : null;
        $unitWord = mb_strtolower(trim((string) ($item['unit'] ?? '')), 'UTF-8');

        // Stage A stores "to taste" as the to_taste unit sentinel — it means
        // "no quantity", exactly like the raw-line rule.
        if (in_array($unitWord, ['to_taste', 'to taste'], true)) {
            $qty = null;
            $unit = null;
        } else {
            $unit = $this->unitClass($unitWord !== '' ? $unitWord : null, $qty);
        }

        return [
            'item' => $this->canonicalizeName($name),
            'qty' => $qty,
            'unit' => $unit,
            'raw' => $raw !== '' ? $raw : $name,
        ];
    }

    /**
     * Normalize a mixed list: strings are parsed as raw lines, arrays as
     * structured items. Entries that normalize to an empty name (blank or
     * placeholder lines) are dropped.
     *
     * @param  list<string|array<string, mixed>>  $lines
     * @return list<array{item: string, qty: float|null, unit: string|null, raw: string}>
     */
    public function set(array $lines): array
    {
        $items = [];
        foreach ($lines as $line) {
            if (is_array($line)) {
                $item = $this->normalizeStructuredItem($line);
            } else {
                $item = $this->normalize((string) $line);
            }

            if ($item['item'] !== '') {
                $items[] = $item;
            }
        }

        return $items;
    }

    /**
     * The normalized item names of an already-normalized set.
     *
     * @param  list<array{item: string, qty: float|null, unit: string|null, raw: string}>  $items
     * @return list<string>
     */
    public function namesOnly(array $items): array
    {
        return array_values(array_filter(array_column($items, 'item')));
    }

    /**
     * The public name canonicalization so other fingerprint pieces
     * (e.g. the extractor's main/supporting split) use identical rules.
     */
    public function canonicalName(string $name): string
    {
        return $this->canonicalizeName($name);
    }

    /**
     * Parse a raw line: leading quantity, optional unit word, then the item
     * name (everything before the first comma, descriptors stripped).
     *
     * @return array{item: string, qty: float|null, unit: string|null, raw: string}
     */
    private function parseRawLine(string $rawLine): array
    {
        $raw = trim($rawLine);
        $line = $raw;

        // "to taste"/"as needed" => no quantity at all (also drop the phrase).
        $toTaste = preg_match('/\b(to taste|as needed|as desired)\s*$/iu', $line) === 1;
        if ($toTaste) {
            $line = trim((string) preg_replace('/\b(to taste|as needed|as desired)\s*$/iu', '', $line));
        }

        $qty = null;
        $unitWord = null;
        if (! $toTaste) {
            [$qty, $line] = $this->extractQuantity($line);

            // The optional unit word right after ANY quantity form. When it
            // is not a unit it stays part of the name ("1 whole egg" keeps
            // "whole" — LEADING_DESCRIPTORS handles it there).
            $token = $this->firstWord($line);
            if ($token !== '' && $this->isUnitWord($token)) {
                $unitWord = $token;
                $line = $this->restOf($line, $token);
            }
        }

        // Drop trailing "for X" purpose clauses ("salt for the pasta water").
        $line = trim((string) preg_replace('/\s+\bfor\b\s+.*$/iu', '', $line));

        // unitClass scales the quantity (by reference) — resolve it before
        // building the result so both fields carry the converted values.
        $unit = $this->unitClass($unitWord, $qty);

        return [
            'item' => $this->canonicalizeName($line),
            'qty' => $qty,
            'unit' => $unit,
            'raw' => $raw,
        ];
    }

    /**
     * Extract the leading quantity from a line: mixed number ("1 1/2"),
     * fraction ("1/2"), unicode fraction ("½", "2½"), range ("3-4" -> lower
     * bound), decimal, integer. Returns [qty, remainder]; qty is null when
     * the line does not start with a number (the unit word, if any, is
     * consumed by the caller right after any quantity form).
     *
     * @return array{0: float|null, 1: string}
     */
    private function extractQuantity(string $line): array
    {
        // "1 1/2"
        if (preg_match('/^(\d+)\s+(\d+)\s*\/\s*(\d+)/u', $line, $m) && (int) $m[3] > 0) {
            return [$this->qtyValue((int) $m[1] + (int) $m[2] / (int) $m[3]), $this->restOf($line, $m[0])];
        }

        // "1/2"
        if (preg_match('/^(\d+)\s*\/\s*(\d+)/u', $line, $m) && (int) $m[2] > 0) {
            return [$this->qtyValue((int) $m[1] / (int) $m[2]), $this->restOf($line, $m[0])];
        }

        // "½" / "2½"
        if (preg_match('/^(\d+)?\s*([½¼¾⅛⅜⅝⅞⅓⅔⅙⅚])/u', $line, $m) && isset(self::UNICODE_FRACTIONS[$m[2]])) {
            $value = (int) ($m[1] ?? 0) + self::UNICODE_FRACTIONS[$m[2]];

            return [$this->qtyValue($value), $this->restOf($line, $m[0])];
        }

        // "3-4" -> lower bound
        if (preg_match('/^(\d+(?:\.\d+)?)\s*[-–]\s*\d+(?:\.\d+)?/u', $line, $m)) {
            return [$this->qtyValue((float) $m[1]), $this->restOf($line, $m[0])];
        }

        // "0.5"
        if (preg_match('/^(\d+\.\d+)/u', $line, $m)) {
            return [$this->qtyValue((float) $m[1]), $this->restOf($line, $m[0])];
        }

        // "2"
        if (preg_match('/^(\d+)/u', $line, $m)) {
            return [$this->qtyValue((int) $m[1]), $this->restOf($line, $m[0])];
        }

        return [null, $line];
    }

    /**
     * True when the token is a recognized unit word (mass/volume/count).
     * The cased Stage A abbreviations "T"/"t" are handled by unitClass, not
     * here — raw lines keep them rare and ambiguous.
     */
    private function isUnitWord(string $token): bool
    {
        if ($token === '') {
            return false;
        }

        $token = rtrim(mb_strtolower($token, 'UTF-8'), '.');

        return isset(self::MASS_UNITS[$token])
            || isset(self::VOLUME_UNITS[$token])
            || in_array($token, self::COUNT_UNITS, true);
    }

    /**
     * Map a unit WORD to its canonical class, applying the frozen conversion
     * factor to the quantity (by reference). Mass and volume stay separate —
     * no density conversions. The cased single-letter cooking abbreviations
     * "T"/"t" (Stage A tablespoon/teaspoon) are tolerated case-sensitively.
     */
    private function unitClass(?string $unitWord, ?float &$qty): ?string
    {
        if ($unitWord === null || $unitWord === '') {
            return null;
        }

        if ($unitWord === 'T') {
            $unitWord = 'tbsp';
        } elseif ($unitWord === 't') {
            $unitWord = 'tsp';
        }

        $word = rtrim(mb_strtolower($unitWord, 'UTF-8'), '.');

        // "fl oz" must be resolved before any "oz" mass reading.
        if (isset(self::VOLUME_UNITS[$word])) {
            $qty = $qty === null ? null : $qty * self::VOLUME_UNITS[$word];

            return 'ml';
        }

        if (isset(self::MASS_UNITS[$word])) {
            $qty = $qty === null ? null : $qty * self::MASS_UNITS[$word];

            return 'gram';
        }

        if (in_array($word, self::COUNT_UNITS, true)) {
            return 'count';
        }

        // Unknown unit: quantity is NOT scaled, unit passes through untouched.
        return $unitWord;
    }

    /**
     * The canonical ingredient NAME for a (possibly messy) text fragment:
     * lowercase, parentheticals dropped, comma-head cut, leading descriptors
     * stripped, synonym phrases resolved, last word singularized (unless the
     * synonym map resolved the name — its values are canonical as written).
     */
    private function canonicalizeName(string $text): string
    {
        $name = $this->collapseWhitespace(trim(mb_strtolower(trim($text), 'UTF-8')));
        if ($name === '') {
            return '';
        }

        // Parentheticals ("(pork cheek)", "(optional)") never carry identity.
        $name = trim((string) preg_replace('/\s*\([^()]*\)/u', ' ', $name));
        // The comma-head IS the ingredient ("pecorino, finely grated").
        $name = trim((string) explode(',', $name)[0]);
        $name = $this->stripLeadingDescriptors($name);

        [$name, $synonymized] = $this->applySynonyms($name);

        // Latin names only: Arabic/other scripts have no trailing-word rules.
        if (! $synonymized && preg_match('/[a-z]/u', $name) === 1) {
            $name = $this->singularize($name);
        }

        return $this->collapseWhitespace($name);
    }

    /**
     * Iteratively strip leading size/freshness/processing descriptors.
     * A name that is JUST a descriptor never exists.
     */
    private function stripLeadingDescriptors(string $name): string
    {
        $previous = null;
        $current = $name;
        while ($previous !== $current) {
            $previous = $current;
            foreach (self::LEADING_DESCRIPTORS as $descriptor) {
                if ($current !== $descriptor) {
                    $current = trim((string) preg_replace('/^'.preg_quote($descriptor, '/').'\s+/u', '', $current));
                }
            }
        }

        return $current;
    }

    /**
     * Resolve synonym phrases (longest-first) against the whole name. Exact
     * hit or hit-as-tail both collapse onto the canonical value — leftover
     * tokens around a mapped phrase are form/brand noise we deliberately
     * drop ("minced garlic cloves" -> garlic).
     *
     * @return array{0: string, 1: bool} [name, whether a synonym resolved]
     */
    private function applySynonyms(string $name): array
    {
        if (isset(self::SYNONYMS[$name])) {
            return [self::SYNONYMS[$name], true];
        }

        foreach (self::SYNONYMS as $key => $value) {
            if (str_ends_with($name, ' '.$key)) {
                return [$value, true];
            }
        }

        return [$name, false];
    }

    /**
     * Singularize the LAST word of a latin name with the documented
     * irregulars plus conservative generic rules.
     */
    private function singularize(string $name): string
    {
        $words = explode(' ', $name);
        $last = $words[count($words) - 1];

        if (isset(self::IRREGULAR_PLURALS[$last])) {
            $words[count($words) - 1] = self::IRREGULAR_PLURALS[$last];
        } else {
            $words[count($words) - 1] = $this->singularizeWord($last);
        }

        return implode(' ', $words);
    }

    /**
     * Conservative single-word plural rules: -ies -> -y, -ves -> -f,
     * -oes/-xes/-ches/-shes/-sses -> -s, otherwise a trailing -s drops.
     * Words under 4 chars and this stop-list stay untouched (defensive:
     * most are already covered by the -ss/-us endings they end with).
     */
    private function singularizeWord(string $word): string
    {
        if (in_array($word, self::NEVER_SINGULAR, true) || mb_strlen($word) < 4) {
            return $word;
        }

        if (str_ends_with($word, 'ies')) {
            return mb_substr($word, 0, -3).'y';
        }

        if (str_ends_with($word, 'ves')) {
            return mb_substr($word, 0, -3).'f';
        }

        if (preg_match('/(oes|xes|ches|shes|sses)$/u', $word) === 1) {
            return mb_substr($word, 0, -2);
        }

        if (str_ends_with($word, 's')
            && ! str_ends_with($word, 'ss')
            && ! str_ends_with($word, 'us')
            && ! str_ends_with($word, 'is')) {
            return mb_substr($word, 0, -1);
        }

        return $word;
    }

    /**
     * Round to 3 decimals so fraction math (1/3) stays JSON-stable.
     */
    private function qtyValue(float $value): float
    {
        return round($value, 3);
    }

    private function restOf(string $line, string $matched): string
    {
        return ltrim(mb_substr($line, mb_strlen($matched)));
    }

    /**
     * @return string the first whitespace-delimited word ("" when empty)
     */
    private function firstWord(string $text): string
    {
        $parts = preg_split('/\s+/u', trim($text)) ?: [''];

        return trim((string) ($parts[0] ?? ''));
    }

    private function collapseWhitespace(string $text): string
    {
        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }
}
