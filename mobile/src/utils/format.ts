import type { Lang, TranslateFn } from "@/i18n";

/**
 * Parses a digits-only field; empty (optional) fields parse to null.
 */
export function parseIntOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compact relative timestamp ("just now", "3h ago", "2d ago", …). Falls back
 * to a local date string past a year; an unparsable timestamp renders as ""
 * (callers hide the caption row).
 */
export function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("rel.now");
  if (mins < 60) return t("rel.minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("rel.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("rel.daysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("rel.weeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("rel.monthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** "Member since {month year}" for a profile created_at ISO stamp. */
export function memberSince(
  t: TranslateFn,
  lang: Lang,
  iso: string,
): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  try {
    const date = new Date(then).toLocaleDateString(
      lang === "ar" ? "ar" : "en-US",
      { month: "long", year: "numeric" },
    );
    return t("profile.memberSince", { date });
  } catch {
    return "";
  }
}
