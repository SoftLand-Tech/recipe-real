/**
 * Localized recipe content getters (slice RECIPE).
 *
 * Web twin of mobile's useLocalizedRecipe/stepTypeLabel/greaseLevelLabel
 * (mobile/src/i18n/index.ts): Arabic columns arrive as `*_ar` fields (null
 * when untranslated); the getters prefer the APP language but fall back to
 * WHICHEVER language exists, so an Arabic-only user recipe still displays
 * Arabic in the English UI (and vice-versa) instead of blanking the field.
 */
import { useCallback, useMemo } from "react";

import { useLang, useT, type TranslateFn } from "@/i18n";
import type { Recipe, RecipeStep } from "@/api/types";

/** First non-empty array of the pair (an empty array counts as "missing"). */
function firstPresentArray(
  primary: string[] | null | undefined,
  fallback: string[] | null | undefined,
): string[] {
  if (primary && primary.length > 0) return primary;
  if (fallback && fallback.length > 0) return fallback;
  return [];
}

export interface LocalizedRecipeText {
  lang: "en" | "ar";
  /** Localized recipe title (app language first, other language as fallback). */
  title: (recipe: Recipe) => string;
  /** Localized ingredient list. */
  ingredients: (recipe: Recipe) => string[];
  /** Localized plain-text steps (recipe_steps carry their own description_ar). */
  steps: (recipe: Recipe) => string[];
  /** Localized step description (detail steps list + cook mode). */
  stepDescription: (step: RecipeStep) => string;
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

/** Labels for raw backend step_type values (cook.* dictionary keys). */
export function stepTypeLabel(t: TranslateFn, raw: string | null | undefined): string {
  switch ((raw ?? "active").toLowerCase()) {
    case "active":
      return t("cook.stepTypeActive");
    case "passive":
      return t("cook.stepTypePassive");
    case "cleanup":
      return t("cook.stepTypeCleanup");
    default:
      return raw ?? "active";
  }
}

/** Capitalize the first letter (e.g. grease level "medium" -> "Medium"). */
function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Labels for backend grease levels (recipe.* dictionary keys). */
export function greaseLevelLabel(t: TranslateFn, raw: string): string {
  switch (raw.toLowerCase()) {
    case "low":
      return t("recipe.greaseLow");
    case "medium":
      return t("recipe.greaseMedium");
    case "high":
      return t("recipe.greaseHigh");
    default:
      return capitalize(raw);
  }
}

/**
 * Relative date for note rows ("2h ago"). Kept dependency-free: a coarse
 * Intl.RelativeTimeFormat when available, else the localized date itself.
 */
export function useRelativeDate(): (iso: string) => string {
  const { lang } = useLang();
  const t = useT();
  return useCallback(
    (iso: string) => {
      const then = Date.parse(iso);
      if (!Number.isFinite(then)) return "";
      const diffMs = Date.now() - then;
      const minutes = Math.round(diffMs / 60000);
      try {
        const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
        if (minutes < 1) return rtf.format(0, "minute");
        if (minutes < 60) return rtf.format(-minutes, "minute");
        const hours = Math.round(minutes / 60);
        if (hours < 24) return rtf.format(-hours, "hour");
        const days = Math.round(hours / 24);
        if (days < 7) return rtf.format(-days, "day");
        return new Intl.DateTimeFormat(lang, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(then);
      } catch {
        // Intl unavailable: fall back to a plain localized date string.
        try {
          return new Date(then).toLocaleDateString();
        } catch {
          return t("recipe.notesTitle");
        }
      }
    },
    [lang, t],
  );
}
