<?php

namespace App\Support;

/**
 * Culinary glossary for Arabic recipe content.
 *
 * Raw machine translation (recipereal:translate-ar) transliterates several
 * common food words instead of using their established Arabic culinary
 * terms ("Cranberry Scones" → "سكون الكرانبيري" instead of
 * "سكونز التوت البري"). This class applies a curated, ordered set of
 * deterministic fixes:
 *
 *   - EXACT: whole-string overrides for verified one-off errors
 *     (hallucinations, wrong condiments, mangled words).
 *   - Conditional cleanups: drop a redundant transliterated parenthetical
 *     ("... التوت البري (كرانبيري)") when the proper term is present.
 *   - MAP: ordered token replacements with Arabic-letter boundaries, so
 *     loanwords that ARE standard (مافن، كوكيز، كيش، تاكو، سوشي، براونيز…)
 *     are never touched.
 *
 * Used by recipereal:glossary-ar (one-off repair of existing _ar Fields)
 * and by recipereal:translate-ar (so new imports arrive clean).
 */
class ArabicFoodGlossary
{
    /** Whole-string overrides: trimmed input => corrected output. */
    public const EXACT = [
        // The sauce, not the bare loanword.
        'بيستو' => 'صلصة البيستو',
        // Chives ≠ green garlic.
        'خبز القشطة الحامضة والثوم الأخضر بآلة الخبز' => 'خبز القشطة الحامضة والثوم المعمر بآلة الخبز',
        // "Creamy Parmesan Leeks" — كرات + cabbage-bud gloss are both wrong.
        'كرات (برعم الكرنب) بالكريمة والبارميزان' => 'الكراث بالكريمة والبارميزان',
        // A person's name, not the herb — kept as-is everywhere else, but
        // this row is the herb ("Rosemary Potatoes").
        'بطاطس روزماري بالميكروويف' => 'بطاطس إكليل الجبل بالميكروويف',
        // Hallucinated fillings that are not in the English titles.
        'طاجن الذرة الكريمي بالجبن والثوم' => 'ذرة لذيذة',
        'ذرة cheesy لذيذة' => 'ذرة بالجبن لذيذة',
        'أسياخ الدجاج والأناناس بالسمسم' => 'أسياخ الدجاج بالسمسم',
        'براونيز الجوز الطري والسهل' => 'براونيز طرية وبسيطة',
        // "Frosting" mangled into جلد (skin/leather).
        'جيلد الكراميل اللذيذ' => 'تغليفة الكراميل اللذيذة',
    ];

    /**
     * Conditional parenthetical cleanups, evaluated first (in order).
     * When any 'if' term is present, the matching redundant transliterated
     * gloss in parentheses is dropped.
     *
     * @var list<array{if: list<string>, pattern: string}>
     */
    public const CONDITIONAL = [
        ['if' => ['التوت البري'], 'pattern' => '/\s*\([^(]*كرانبيري[^(]*\)/u'],
        ['if' => ['توت العليق', 'التوت الأحمر'], 'pattern' => '/\s*\([^(]*راسبيري[^(]*\)/u'],
        ['if' => ['التوت الأزرق'], 'pattern' => '/\s*\([^(]*بلوبيري[^(]*\)/u'],
        ['if' => ['جزر أبيض', 'الجزر الأبيض'], 'pattern' => '/\s*\([^(]*(?:بارسنيب|باسترناك)[^(]*\)/u'],
    ];

    /**
     * Ordered token replacements [name, pattern, replacement].
     * Order matters: longer/definite forms before their bare substrings.
     *
     * @var list<array{string, string, string}>
     */
    public const RULES = [
        // Pecan: "pecan" arabizes to بقان; "الجوز البيكان" mixes both.
        ['pecan-mixed', '/الجوز البيكان/u', 'جوز البقان'],
        ['pecan-def', '/البيكان/u', 'البقان'],
        ['pecan-bare', '/(?<![\p{Arabic}])بيكان(?![\p{Arabic}])/u', 'بقان'],
        // Cranberry => التوت البري (prefixes ride along: بالكرانبيري =>
        // بالتوت البري, والكرانبيري => والتوت البري).
        ['cranberry-def', '/الكرانبيري/u', 'التوت البري'],
        ['cranberry-bare', '/كرانبيري/u', 'توت بري'],
        // Scones: the loanword is سكونز; bare سكون reads as "stillness".
        ['scone-sh', '/سكونش/u', 'سكونز'],
        ['scone-bare', '/(?<![\p{Arabic}])سكون(?![\p{Arabic}])/u', 'سكونز'],
        // Rosemary => إكليل الجبل (بالX => بإX handled explicitly).
        ['rosemary-bi', '/بالروزماري/u', 'بإكليل الجبل'],
        ['rosemary-def', '/الروزماري/u', 'إكليل الجبل'],
        // Raspberry => توت العليق (الراسبيري => التوت العليق via prefix).
        ['raspberry', '/راسبيري/u', 'توت العليق'],
        // Blueberry => التوت الأزرق.
        ['blueberry-def', '/البلوبيري/u', 'التوت الأزرق'],
        ['blueberry-bare', '/بلوبيري/u', 'توت أزرق'],
        // Parsnip => الجزر الأبيض.
        ['parsnip-al', '/الباسترناك/u', 'الجزر الأبيض'],
        ['parsnip-bare', '/باسترناك/u', 'جزر أبيض'],
        ['parsnip-al2', '/البارسنيب/u', 'الجزر الأبيض'],
        ['parsnip-bare2', '/بارسنيب/u', 'جزر أبيض'],
        // Brussels sprouts are كرنب, not broccoli.
        ['brussels', '/بروكلي بروكسل/u', 'كرنب بروكسل'],
        // Misspelled Levantine form; the library's voice is خرشوف.
        ['artichoke', '/الأرضي شوكة/u', 'الخرشوف'],
        // Bare العليق (not توت العليق, not العليق الأسود).
        ['blackberry', '/(?<!توت )العليق(?! الأسود)/u', 'التوت الأسود'],
        // oregano mis-transliterated with ج instead of غ.
        ['oregano', '/الأوريجانو/u', 'الأوريغانو'],
    ];

    /**
     * Apply the glossary to one Arabic string. Pure + idempotent.
     */
    public static function apply(string $text): string
    {
        [$out] = self::applyWithHits($text);

        return $out;
    }

    /**
     * Apply the glossary, reporting per-rule hit counts.
     *
     * @return array{0: string, 1: array<string, int>}
     */
    public static function applyWithHits(string $text): array
    {
        $hits = [];
        $t = trim($text);
        if ($t === '') {
            return ['', $hits];
        }

        if (isset(self::EXACT[$t])) {
            return [self::EXACT[$t], ['exact' => 1]];
        }

        foreach (self::CONDITIONAL as $i => $rule) {
            $present = false;
            foreach ($rule['if'] as $term) {
                if (str_contains($t, $term)) {
                    $present = true;
                    break;
                }
            }
            if (! $present) {
                continue;
            }
            $t = preg_replace($rule['pattern'], '', $t, -1, $count);
            if ($count > 0) {
                $hits["cond-{$i}"] = ($hits["cond-{$i}"] ?? 0) + $count;
            }
        }

        foreach (self::RULES as [$name, $pattern, $replacement]) {
            $t = preg_replace($pattern, $replacement, $t, -1, $count);
            if ($count > 0) {
                $hits[$name] = ($hits[$name] ?? 0) + $count;
            }
        }

        // Collapse runs left behind by dropped parentheticals (newlines in
        // steps are preserved — only horizontal whitespace collapses).
        $t = trim((string) preg_replace('/[ \t]{2,}/u', ' ', $t));

        return [$t, $hits];
    }

    /**
     * Recursively apply the glossary to every string leaf of decoded JSON
     * data (ingredients / steps arrays). Non-string leaves pass through.
     */
    public static function applyDeep(mixed $data): mixed
    {
        if (is_string($data)) {
            return self::apply($data);
        }
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = self::applyDeep($value);
            }
        }

        return $data;
    }
}
