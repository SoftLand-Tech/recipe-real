<?php

namespace App\Support;

/**
 * Shared normalizer and payload builder for the bilingual `recipes_fts`
 * FTS5 index (English + Arabic titles, ingredients, and description).
 *
 * Keep index-time normalization and query-time MATCH construction here so
 * RebuildSearchIndex, RecipePublisher, UserRecipeController, and
 * RecipeController stay in lockstep.
 */
final class RecipeFtsIndex
{
    /** Arabic diacritics (tashkeel), superscript alef, and tatweel. */
    private const ARABIC_MARKS_PATTERN = '/[\x{064B}-\x{065F}\x{0670}\x{0640}]/u';

    private const TOKEN_STRIP_PATTERN = '/[^\p{L}\p{N}]/u';

    /** Common Arabic orthographic variants unified for forgiving matching. */
    private const ARABIC_FOLD_MAP = [
        'أ' => 'ا',
        'إ' => 'ا',
        'آ' => 'ا',
        'ٱ' => 'ا',
        'ى' => 'ي',
        'ة' => 'ه',
    ];

    /**
     * Build the exact `recipes_fts` row payload from raw DB attributes.
     *
     * @return array{rowid: int, title: string, title_ar: string, ingredients: string, ingredients_ar: string, description: string}
     */
    public static function row(
        int $id,
        string $title,
        ?string $titleAr,
        ?string $ingredientsRaw,
        ?string $ingredientsArRaw,
        ?string $description,
    ): array {
        return [
            'rowid' => $id,
            'title' => mb_strtolower($title, 'UTF-8'),
            'title_ar' => self::indexableArabic($titleAr),
            'ingredients' => $ingredientsRaw ?? '',
            'ingredients_ar' => self::indexableArabic($ingredientsArRaw),
            'description' => $description ?? '',
        ];
    }

    /**
     * Decode an Arabic column (plain string or JSON array string) and prepare
     * normalized tokens plus `ال`-stripped stems for prefix matching.
     */
    public static function indexableArabic(?string $raw): string
    {
        if ($raw === null || $raw === '') {
            return '';
        }

        $trimmed = ltrim($raw);
        if (str_starts_with($trimmed, '[')) {
            $decoded = json_decode($trimmed, true);
            if (is_array($decoded)) {
                $raw = implode(' ', array_map('strval', $decoded));
            }
        }

        $normalized = self::normalize($raw);
        if ($normalized === '') {
            return '';
        }

        $stems = [];
        foreach (preg_split('/\s+/u', $normalized) ?: [] as $part) {
            $token = (string) preg_replace(self::TOKEN_STRIP_PATTERN, '', $part);
            if ($token === '') {
                continue;
            }
            $stem = self::stripArabicDefiniteArticle($token);
            if ($stem !== null) {
                $stems[$stem] = true;
            }
        }

        if ($stems === []) {
            return $normalized;
        }

        return $normalized.' '.implode(' ', array_keys($stems));
    }

    /**
     * Build a safe SQLite FTS5 MATCH expression for bilingual free text.
     */
    public static function matchExpression(string $query): string
    {
        $normalized = self::normalize($query);
        if ($normalized === '') {
            return '';
        }

        $clauses = [];
        foreach (preg_split('/\s+/u', $normalized) ?: [] as $part) {
            $token = (string) preg_replace(self::TOKEN_STRIP_PATTERN, '', $part);
            if ($token === '') {
                continue;
            }

            $stem = self::stripArabicDefiniteArticle($token);
            $clauses[] = $stem !== null
                ? "({$token}* OR {$stem}*)"
                : $token.'*';
        }

        return implode(' AND ', $clauses);
    }

    /**
     * Lowercase UTF-8 text and fold Arabic diacritics / common letter forms.
     */
    public static function normalize(string $text): string
    {
        $text = mb_strtolower($text, 'UTF-8');
        $text = (string) preg_replace(self::ARABIC_MARKS_PATTERN, '', $text);

        return strtr($text, self::ARABIC_FOLD_MAP);
    }

    private static function stripArabicDefiniteArticle(string $token): ?string
    {
        if (! str_starts_with($token, 'ال')) {
            return null;
        }

        if (mb_strlen($token, 'UTF-8') < 5) {
            return null;
        }

        return mb_substr($token, 2, null, 'UTF-8');
    }
}
