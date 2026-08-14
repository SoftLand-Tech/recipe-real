/**
 * Pure cook-history analytics: day streaks and display-ready history rows.
 *
 * The only import is a type, so these functions carry zero runtime
 * dependencies — safe to use from any screen, hook, or test without pulling
 * in the API client or the SQLite layer.
 */

import type { CookSessionSummary } from "@/types";

/** A calendar day (YYYY-MM-DD) on which at least one cook session was logged. */
export interface CookedDay {
  date: string;
}

/** One display-ready row for the history list. */
export interface HistoryEntry {
  id: number;
  /** YYYY-MM-DD day of the session. */
  date: string;
  title: string;
  actualMinutes: number | null;
  communityMinutes: number | null;
  /**
   * (actual - community) / community * 100, rounded. Null whenever the delta
   * can't be computed: either side null, or community is 0 (division by zero).
   */
  deltaPercent: number | null;
}

const MS_PER_DAY = 86_400_000;

/**
 * Day key (YYYY-MM-DD) for an ISO timestamp.
 *
 * NOTE: UTC-based — `toISOString().slice(0, 10)` cuts at the UTC date, so a
 * session logged at 23:00 local in UTC-7 lands on the NEXT UTC day. Accepted
 * for streak display; documented rather than fixed. Returns null for
 * unparseable timestamps (skipped by every caller).
 */
function dayKey(isoDate: string): string | null {
  const ms = Date.parse(isoDate);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

function dayKeyFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The day before a YYYY-MM-DD key. Day keys are UTC dates, so -24h is exact. */
function prevDay(day: string): string {
  return dayKeyFromMs(Date.parse(`${day}T00:00:00Z`) - MS_PER_DAY);
}

/**
 * Sorted unique cooked days (ascending). Multiple sessions on the same day
 * collapse into one day; malformed timestamps are skipped.
 */
function cookedDays(sessions: { created_at: string }[]): CookedDay[] {
  const keys = new Set<string>();
  for (const session of sessions) {
    const key = dayKey(session.created_at);
    if (key) keys.add(key);
  }
  return [...keys].sort().map((date) => ({ date }));
}

/**
 * Streak stats over a user's cook sessions.
 */
export function computeStreak(sessions: { created_at: string }[]): {
  /**
   * Consecutive cooked days ending today. If today has no session yet, the
   * count may end yesterday instead — a streak stays alive until the day
   * fully passes.
   */
  currentStreak: number;
  /** Sessions logged in the 7-day window ending today. */
  weekCount: number;
  /** Longest run of consecutive cooked days ever. */
  bestStreak: number;
} {
  const days = cookedDays(sessions);
  if (days.length === 0) {
    return { currentStreak: 0, weekCount: 0, bestStreak: 0 };
  }

  // -- bestStreak: longest run in the sorted unique day list ------------------
  let bestStreak = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = prevDay(days[i].date) === days[i - 1].date ? run + 1 : 1;
    if (run > bestStreak) bestStreak = run;
  }

  // -- currentStreak: walk back from today, else from yesterday ---------------
  const daySet = new Set(days.map((d) => d.date));
  const today = dayKeyFromMs(Date.now());
  let cursor = daySet.has(today) ? today : prevDay(today);
  let currentStreak = 0;
  while (daySet.has(cursor)) {
    currentStreak += 1;
    cursor = prevDay(cursor);
  }

  // -- weekCount: sessions inside the 7-day window ending today ---------------
  const windowStart = dayKeyFromMs(Date.now() - 6 * MS_PER_DAY);
  const weekCount = sessions.filter((s) => {
    const key = dayKey(s.created_at);
    return key != null && key >= windowStart;
  }).length;

  return { currentStreak, weekCount, bestStreak };
}

/**
 * Map cook sessions to display-ready history rows: the most recent `limit`
 * (default 20) sessions, newest first, each carrying the actual vs community
 * pace delta. `total_actual_minutes` and `community_avg_minutes` are nullable
 * in the API shape, so deltaPercent is null whenever it can't be computed.
 */
export function summarizeHistory(
  sessions: CookSessionSummary[],
  limit = 20,
): HistoryEntry[] {
  const sorted = [...sessions].sort(
    (a, b) =>
      (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0),
  );
  return sorted.slice(0, limit).map((session) => {
    const actual = session.total_actual_minutes;
    const community = session.recipe.community_avg_minutes;
    const deltaPercent =
      actual != null && community != null && community > 0
        ? Math.round(((actual - community) / community) * 100)
        : null;
    return {
      id: session.id,
      date: dayKey(session.created_at) ?? "",
      title: session.recipe.title,
      actualMinutes: actual,
      communityMinutes: community,
      deltaPercent,
    };
  });
}
