<?php

namespace App\Support;

/**
 * Parses the Kaggle Food.com dataset's R-style vector strings:
 * c("a", "b") → ["a", "b"].
 *
 * Hardened replacement for ImportFoodcom's original parseRVector(). That one
 * split with str_getcsv(), which mis-handles rows whose text contains escaped
 * quotes — the CSV reader cut such fields at the first `\"` (or doubled `""`),
 * so the whole c(...) blob survived as ONE un-split string and became a single
 * giant recipe step. This parser is a small character-by-character state
 * machine instead:
 *
 *   - elements are split on commas that sit outside double quotes;
 *   - surrounding quotes are consumed (not kept) as element delimiters;
 *   - `\"` (R-dump style) and `""` (CSV-doubling style) are both unescaped to
 *     a literal `"` during the walk;
 *   - truncated vectors (missing closing `)` and/or a dangling unterminated
 *     final element — the row was cut at an escaped quote) still yield every
 *     element up to the cut;
 *   - elements that are themselves c(...) vectors are recursed into;
 *   - R's empty markers (NULL, NA, character(0)) parse to [].
 */
class RVector
{
    /**
     * @return list<string>
     */
    public static function parse(string $value): array
    {
        $value = trim($value);
        if ($value === '' || strtoupper($value) === 'NULL' || strtoupper($value) === 'NA'
            || strtolower($value) === 'character(0)') {
            return [];
        }

        if (preg_match('/^\s*c\(/i', $value) !== 1) {
            return [$value];
        }

        $body = preg_replace('/^\s*c\(/i', '', $value);
        $body = (string) $body;
        // Drop the vector's closing paren when present; truncated blobs keep
        // whatever text survived the cut.
        $rtrimmed = rtrim($body);
        if (substr($rtrimmed, -1) === ')') {
            $body = substr($rtrimmed, 0, -1);
        }

        $out = [];
        foreach (self::splitElements($body) as $item) {
            $item = trim($item);
            // Strip one pair of surrounding quotes (or a lone leading /
            // trailing quote left behind by truncation).
            if ($item !== '' && $item[0] === '"') {
                $item = substr($item, 1);
            }
            if ($item !== '' && substr($item, -1) === '"') {
                $item = substr($item, 0, -1);
            }
            $item = trim($item);
            if ($item === '' || strtoupper($item) === 'NA') {
                continue;
            }
            // Some rows carry a second level of vector-stringifying.
            if (preg_match('/^\s*c\(/i', $item) === 1) {
                foreach (self::parse($item) as $nested) {
                    $out[] = $nested;
                }
            } else {
                $out[] = $item;
            }
        }

        return $out;
    }

    /**
     * Split a vector body on commas that sit outside double quotes AND
     * outside nested parentheses (so a nested c("b", "c") element stays
     * intact for recursion). Quotes delimiting an element are consumed;
     * escape sequences (`\"`, `""`) are resolved to literal quotes during
     * the walk. An unterminated final element (truncated row) is kept as-is.
     *
     * @return list<string>
     */
    private static function splitElements(string $body): array
    {
        $elements = [];
        $current = '';
        $inQuotes = false;
        $depth = 0;
        $len = strlen($body);

        for ($i = 0; $i < $len; $i++) {
            $ch = $body[$i];

            if (! $inQuotes) {
                if ($ch === '"') {
                    $inQuotes = true; // opening quote — element delimiter
                } elseif ($ch === '(') {
                    $depth++;
                    $current .= $ch;
                } elseif ($ch === ')') {
                    $depth = max(0, $depth - 1);
                    $current .= $ch;
                } elseif ($ch === ',' && $depth === 0) {
                    $elements[] = $current;
                    $current = '';
                } else {
                    $current .= $ch;
                }

                continue;
            }

            // Inside quotes: both escape styles mean a literal quote.
            if ($ch === '\\' && $i + 1 < $len && $body[$i + 1] === '"') {
                $current .= '"';
                $i++;
            } elseif ($ch === '"' && $i + 1 < $len && $body[$i + 1] === '"') {
                $current .= '"';
                $i++;
            } elseif ($ch === '"') {
                $inQuotes = false; // closing quote — element delimiter
            } else {
                $current .= $ch;
            }
        }

        $elements[] = $current;

        return $elements;
    }
}
