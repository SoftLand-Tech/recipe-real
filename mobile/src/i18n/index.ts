/**
 * i18n facade. The language preference lives in the shared ThemePrefProvider
 * (single source of truth, persisted in AsyncStorage) — this module only adds
 * the translation lookup + localized-content helpers on top of it.
 */
import { useCallback, useMemo } from "react";

import type { Recipe, RecipeStep } from "@/types";
import {
  useThemePrefs,
  type Lang,
  type LangDir,
  type LangPref,
} from "@/theme/ThemeProvider";

import { ar } from "./ar";
import { en } from "./en";

export type { Lang, LangDir, LangPref };

/** Interpolation params for `{placeholder}` tokens in dictionary values. */
export type TParams = Record<string, string | number>;

/** `(key, params?) => string` translator. */
export type TranslateFn = (key: string, params?: TParams) => string;

function interpolate(template: string, params: TParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match,
  );
}

/**
 * Translate `key` for `lang`. Falls back to the English string when the key
 * is missing from the Arabic dictionary, and to the key itself when it's
 * missing from both (never crashes on a typo'd key).
 */
export function translate(lang: Lang, key: string, params?: TParams): string {
  const raw = (lang === "ar" ? ar[key] : undefined) ?? en[key] ?? key;
  return params ? interpolate(raw, params) : raw;
}

/** Resolved language + layout direction (and the persisted preference). */
export function useLang(): {
  lang: Lang;
  dir: LangDir;
  langPref: LangPref;
  setLangPref: (pref: LangPref) => void;
} {
  const { lang, dir, langPref, setLangPref } = useThemePrefs();
  return useMemo(
    () => ({ lang, dir, langPref, setLangPref }),
    [lang, dir, langPref, setLangPref],
  );
}

/** Translation hook — re-renders (via context) when the language changes. */
export function useT(): TranslateFn {
  const { lang } = useLang();
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}

/**
 * Label for a raw backend step_type ("active" | "passive" | "cleanup" | ...).
 * Unknown values fall back to the raw string instead of leaking a key.
 */
export function stepTypeLabel(
  t: TranslateFn,
  raw: string | null | undefined,
): string {
  const key = `stepType.${(raw ?? "active").toLowerCase()}`;
  return en[key] != null ? t(key) : (raw ?? "active");
}

/** Capitalize the first letter (e.g. grease level "medium" -> "Medium"). */
function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Label for a backend grease level ("low" | "medium" | "high" | ...).
 * Unknown values fall back to the capitalized raw string.
 */
export function greaseLevelLabel(t: TranslateFn, raw: string): string {
  const key = `grease.${raw.toLowerCase()}`;
  return en[key] != null ? t(key) : capitalize(raw);
}

// ---- Localized minute formatting ---------------------------------------------
// The core lives here (not in TimeChip) so both the TimeChip component and
// screens can share it without a component↔i18n import cycle.

/** Format a minute count with explicit unit suffixes, e.g. "45m" / "1h 5m". */
export function formatMinutes(m: number, mUnit: string, hUnit: string): string {
  if (!Number.isFinite(m) || m <= 0) return `0${mUnit}`;
  if (m < 60) return `${Math.round(m)}${mUnit}`;
  const h = Math.floor(m / 60);
  const rem = Math.round(m % 60);
  return rem === 0 ? `${h}${hUnit}` : `${h}${hUnit} ${rem}${mUnit}`;
}

/** Pure English formatter (unit-agnostic callers / non-hook contexts). */
export function fmtMinutes(m: number): string {
  return formatMinutes(m, "m", "h");
}

/** Locale-aware `fmtMinutes` hook ("45m" → "45 د" in Arabic). */
export function useFmtMinutes(): (m: number) => string {
  const t = useT();
  return useCallback(
    (m: number) => formatMinutes(m, t("common.min"), t("common.h")),
    [t],
  );
}

// ---- Localized recipe content --------------------------------------------------
// Arabic columns arrive as `*_ar` fields (null when untranslated). Getters
// prefer the APP language but fall back to WHICHEVER language exists, so an
// Arabic-only user recipe still displays Arabic in the English UI (and
// vice-versa) instead of blanking the field.

export interface LocalizedRecipeText {
  lang: Lang;
  /** Localized recipe title (app language first, other language as fallback). */
  title: (recipe: Recipe) => string;
  /** Localized ingredient list. */
  ingredients: (recipe: Recipe) => string[];
  /** Localized plain-text steps (recipe_steps carry their own description_ar). */
  steps: (recipe: Recipe) => string[];
  /** Localized step description (detail timeline, steps list, cook mode). */
  stepDescription: (step: RecipeStep) => string;
}

/** First non-empty array of the pair (an empty array counts as "missing"). */
function firstPresentArray(
  primary: string[] | null | undefined,
  fallback: string[] | null | undefined,
): string[] {
  if (primary && primary.length > 0) return primary;
  if (fallback && fallback.length > 0) return fallback;
  return [];
}

/** Localized getters for recipe content in the current language. */
export function useLocalizedRecipe(): LocalizedRecipeText {
  const { lang } = useLang();
  return useMemo(
    () => ({
      lang,
      title: (r) =>
        lang === "ar"
          ? (r.title_ar ?? r.title ?? "")
          : (r.title ?? r.title_ar ?? ""),
      ingredients: (r) =>
        firstPresentArray(
          lang === "ar" ? r.ingredients_ar : r.ingredients,
          lang === "ar" ? r.ingredients : r.ingredients_ar,
        ),
      steps: (r) =>
        firstPresentArray(
          lang === "ar" ? r.steps_ar : r.steps,
          lang === "ar" ? r.steps : r.steps_ar,
        ),
      stepDescription: (s) =>
        lang === "ar"
          ? (s.description_ar ?? s.description ?? "")
          : (s.description ?? s.description_ar ?? ""),
    }),
    [lang],
  );
}
