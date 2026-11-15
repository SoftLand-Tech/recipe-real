/**
 * Pure helpers shared by the community pages (feed card, detail, composer).
 *
 * Ported from the mobile screens: relative-date formatting with the same
 * buckets (now/minutes/hours/days/weeks/months → localized date), author
 * display-name resolution, localized attached-recipe titles with the
 * single-language fallback, and initials for avatar fallbacks.
 */
import type { Lang, TranslateFn } from "@/i18n";
import type { PostRecipe, PostUser } from "@/api/types";

/** Compact localized relative timestamp; "" for unparsable input (row hides it). */
export function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("community.relNow");
  if (mins < 60) return t("community.relMinutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("community.relHoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("community.relDaysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("community.relWeeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("community.relMonthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Display name of a post/comment author: display_name, else the account name. */
export function authorName(user: PostUser): string {
  return (user.display_name ?? user.name ?? "").trim();
}

/** Localized attached-recipe title: app language first, other language when untranslated. */
export function postRecipeTitle(lang: Lang, recipe: PostRecipe): string {
  return lang === "ar"
    ? (recipe.title_ar ?? recipe.title ?? "")
    : (recipe.title ?? recipe.title_ar ?? "");
}

/** Initials for the avatar fallback ("Fatima Al" → "FA"; single word → first letter). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1)).toUpperCase();
}
