/**
 * Servings-scaler math for ingredient lines (slice RECIPE).
 *
 * Faithful port of the scaling engine in mobile/src/app/recipe/[id].tsx: a
 * leading quantity on each ingredient line (integer, decimal, unicode
 * fraction ½, ascii fraction 1/2, mixed 1 1/2, or a range "2-3") is parsed,
 * multiplied by the scale multiplier, and re-formatted with kitchen-fraction
 * snapping (¼ ⅓ ½ ⅔ ¾ within a 0.025 tolerance). Structured rows
 * (ingredients_structured) scale their qty field when present; plain lines
 * fall back to rewriting the raw text's leading token.
 */
import type { Recipe } from "@/api/types";

/** One entry of the backend `ingredients_structured` JSON column. */
export interface StructuredIngredient {
  raw?: string | null;
  qty?: number | string | null;
  qty_display?: string | null;
  unit?: string | null;
  item?: string | null;
  prep?: string | null;
}

/**
 * Parse `ingredients_structured` defensively. The API ships it as an object
 * (`{"v":1,"items":[…]}`) but it may arrive as a raw JSON string or be
 * absent entirely — every failure mode returns [] so the plain-text bullets
 * remain the fallback.
 */
export function parseStructuredIngredients(value: unknown): StructuredIngredient[] {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (parsed == null || typeof parsed !== "object") return [];
  const items = (parsed as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];
  return items.filter(
    (entry): entry is StructuredIngredient =>
      entry != null && typeof entry === "object",
  );
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

const KITCHEN_FRACTIONS: readonly (readonly [number, string])[] = [
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.5, "½"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
];

const FRACTION_TOLERANCE = 0.025;

/**
 * Format a scaled ingredient number cleanly, snapping values close to common
 * kitchen fractions (`¼, ⅓, ½, ⅔, ¾`) and otherwise formatting whole or
 * single-decimal values.
 */
export function formatScaledNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return String(value);
  const whole = Math.floor(value);
  const frac = value - whole;

  if (frac < FRACTION_TOLERANCE) {
    if (whole > 0) return String(whole);
    const rounded = Math.round(value * 10) / 10;
    return String(rounded || Number(value.toFixed(2)));
  }
  if (frac > 1 - FRACTION_TOLERANCE) {
    return String(whole + 1);
  }

  for (const [target, symbol] of KITCHEN_FRACTIONS) {
    if (Math.abs(frac - target) < FRACTION_TOLERANCE) {
      return whole > 0 ? `${whole} ${symbol}` : symbol;
    }
  }

  const rounded = Math.round(value * 10) / 10;
  return String(rounded);
}

/** Parse a numeric or fraction quantity (e.g. `1.5`, `"1/2"`, `"1 1/2"`, `"½"`). */
export function parseQuantityValue(
  raw: number | string | null | undefined,
): number | null {
  if (typeof raw === "number") {
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const mixedAscii = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (mixedAscii) {
    const whole = Number(mixedAscii[1]);
    const num = Number(mixedAscii[2]);
    const den = Number(mixedAscii[3]);
    return den > 0 ? whole + num / den : null;
  }

  const mixedUnicode = /^(\d+)\s*([½⅓⅔¼¾⅛⅜⅝⅞])$/.exec(trimmed);
  if (mixedUnicode) {
    const whole = Number(mixedUnicode[1]);
    const frac = UNICODE_FRACTIONS[mixedUnicode[2]];
    return frac != null ? whole + frac : null;
  }

  const asciiFrac = /^(\d+)\s*\/\s*(\d+)$/.exec(trimmed);
  if (asciiFrac) {
    const num = Number(asciiFrac[1]);
    const den = Number(asciiFrac[2]);
    return den > 0 ? num / den : null;
  }

  if (UNICODE_FRACTIONS[trimmed] != null) {
    return UNICODE_FRACTIONS[trimmed];
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  return null;
}

const QTY_PATTERN =
  "(?:\\d+\\s+\\d+\\s*/\\s*\\d+|\\d+\\s*[½⅓⅔¼¾⅛⅜⅝⅞]|\\d+\\s*/\\s*\\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\\d+(?:\\.\\d+)?)";

const LEADING_RANGE_RE = new RegExp(
  `^(\\s*)(${QTY_PATTERN})(\\s*[-–]\\s*)(${QTY_PATTERN})(?!\\s*[-–/.\\d])([\\s\\S]*)$`,
);

const LEADING_SINGLE_RE = new RegExp(
  `^(\\s*)(${QTY_PATTERN})(?!\\s*[-–/.\\d])([\\s\\S]*)$`,
);

/**
 * Scale a leading integer, decimal, fraction, mixed number or range on a raw
 * ingredient line when `mult !== 1`.
 */
export function scaleRawIngredientLine(raw: string, mult: number): string {
  if (mult === 1 || !Number.isFinite(mult) || mult <= 0) return raw;

  const rangeMatch = LEADING_RANGE_RE.exec(raw);
  if (rangeMatch) {
    const [, lead, firstToken, sep, secondToken, rest] = rangeMatch;
    const q1 = parseQuantityValue(firstToken);
    const q2 = parseQuantityValue(secondToken);
    if (q1 != null && q2 != null) {
      return `${lead}${formatScaledNumber(q1 * mult)}${sep}${formatScaledNumber(q2 * mult)}${rest}`;
    }
  }

  const singleMatch = LEADING_SINGLE_RE.exec(raw);
  if (singleMatch) {
    const [, lead, token, rest] = singleMatch;
    const q = parseQuantityValue(token);
    if (q != null) {
      return `${lead}${formatScaledNumber(q * mult)}${rest}`;
    }
  }

  return raw;
}

/** How one ingredient row renders: structured split when available. */
export interface IngredientDisplay {
  hasStructure: boolean;
  qtyPart: string;
  itemText: string;
  fullText: string;
}

/**
 * Format one ingredient row for display at `scaleMultiplier`: the structured
 * qty/unit/item/prep fields when present (qty scaled), else the raw line with
 * its leading quantity token rewritten.
 */
export function formatIngredientDisplay(
  ingredient: string,
  structured: StructuredIngredient | undefined,
  scaleMultiplier: number,
): IngredientDisplay {
  const rawQty =
    structured?.qty_display ??
    (structured?.qty != null ? String(structured.qty) : null);
  let qty = rawQty;
  if (scaleMultiplier !== 1) {
    const parsedQty = parseQuantityValue(
      structured?.qty != null ? structured.qty : structured?.qty_display,
    );
    if (parsedQty != null) {
      qty = formatScaledNumber(parsedQty * scaleMultiplier);
    }
  }
  const unit = structured?.unit?.trim() || null;
  const itemText = [structured?.item?.trim(), structured?.prep?.trim()]
    .filter(Boolean)
    .join(", ");
  const qtyPart = [qty, unit].filter(Boolean).join(" ");
  const hasStructure = qtyPart !== "" && itemText !== "";
  if (hasStructure) {
    return {
      hasStructure: true,
      qtyPart,
      itemText,
      fullText: `${qtyPart} ${itemText}`,
    };
  }
  return {
    hasStructure: false,
    qtyPart: "",
    itemText: "",
    fullText: scaleRawIngredientLine(ingredient, scaleMultiplier),
  };
}

/** Servings label for the ingredients card: the scaled servings count. */
export function scaledServings(recipe: Recipe, mult: number): number | null {
  if (recipe.servings == null || recipe.servings <= 0) return null;
  return Math.round(recipe.servings * mult);
}
