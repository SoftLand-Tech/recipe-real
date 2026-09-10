import AsyncStorage from "@react-native-async-storage/async-storage";

import { getCachedRecipe } from "@/db/database";
import {
  cancelStepAlarm,
  formatCookElapsed,
  startCookNotification,
  stopCookNotification,
} from "@/utils/cookAlarms";
import type { TranslateFn } from "@/i18n";

/**
 * Single source of truth for "is there a live cook session?" outside the
 * Cook Mode screen. The screen persists its stopwatch to AsyncStorage
 * (`cook-session:{recipeId}`) on every change and clears it on finish or
 * discard — so a fresh (<24h), running/paused snapshot means a cook is
 * active even if the app was killed and the screen never mounted.
 *
 * Used by the app-wide active-cook banner (always visible, incl. iOS and
 * Expo Go where no system notification exists) and by cold-start logic
 * that re-posts the sticky Android notification.
 */

const COOK_SESSION_PREFIX = "cook-session:";
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

export interface ActiveCookSession {
  recipeId: number;
  title: string | null;
  cookStartAt: number;
  pausedAt: number | null;
  pausedMsTotal: number;
  status: "running" | "paused";
  armedAlarmId: string | null;
}

/** Pause-adjusted elapsed ms for a session at wall instant `at`. */
export function activeSessionElapsedMs(
  session: Pick<ActiveCookSession, "cookStartAt" | "pausedAt" | "pausedMsTotal">,
  at: number,
): number {
  const end = session.pausedAt ?? at;
  return Math.max(0, end - session.cookStartAt - session.pausedMsTotal);
}

/** Display elapsed (`M:SS` / `H:MM:SS`) for a session at wall instant `at`. */
export function formatActiveSessionElapsed(
  session: Pick<ActiveCookSession, "cookStartAt" | "pausedAt" | "pausedMsTotal">,
  at: number,
): string {
  return formatCookElapsed(activeSessionElapsedMs(session, at));
}

function isActiveSnapshot(value: unknown): value is ActiveCookSession & {
  v: unknown;
} {
  if (value == null || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    (s.v === 1 || s.v === 2) &&
    typeof s.recipeId === "number" &&
    Number.isFinite(s.recipeId) &&
    typeof s.cookStartAt === "number" &&
    Date.now() - s.cookStartAt < MAX_SNAPSHOT_AGE_MS &&
    (s.status === "running" || s.status === "paused")
  );
}

/**
 * The most recently started live session, if any. Title resolves from the
 * snapshot itself (v2+) with an offline recipe-cache lookup fallback (v1).
 * Never throws — null means "no banner".
 */
export async function readActiveCookSession(): Promise<ActiveCookSession | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    let best: ActiveCookSession | null = null;
    let bestStart = -1;
    for (const key of keys) {
      if (!key.startsWith(COOK_SESSION_PREFIX)) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw == null) continue;
        const parsed: unknown = JSON.parse(raw);
        if (!isActiveSnapshot(parsed)) continue;
        if (parsed.cookStartAt <= bestStart) continue;
        bestStart = parsed.cookStartAt;
        const snapshotTitle =
          typeof (parsed as { title?: unknown }).title === "string" &&
          ((parsed as { title: string }).title !== "")
            ? ((parsed as { title: string }).title)
            : null;
        best = {
          recipeId: parsed.recipeId,
          title: snapshotTitle,
          cookStartAt: parsed.cookStartAt,
          pausedAt:
            typeof parsed.pausedAt === "number" ? parsed.pausedAt : null,
          pausedMsTotal:
            typeof parsed.pausedMsTotal === "number"
              ? parsed.pausedMsTotal
              : 0,
          status: parsed.status,
          armedAlarmId:
            typeof parsed.armedAlarmId === "string"
              ? parsed.armedAlarmId
              : null,
        };
      } catch {
        // Corrupt snapshot — the cook screen drops it on mount.
      }
    }
    if (best && !best.title) {
      // v1 snapshot (no embedded title): resolve offline, else untitled.
      try {
        const cached = await getCachedRecipe(best.recipeId);
        if (cached) best = { ...best, title: cached.title };
      } catch {
        // Offline cache unreadable — banner still shows, untitled.
      }
    }
    return best;
  } catch {
    return null;
  }
}

/**
 * Discard a live session from OUTSIDE the cook screen (the banner's End
 * action): cancel its armed step alarm, drop the sticky notification and
 * remove the snapshot so it never resurrects. The session's timings are
 * lost — callers confirm first (ActionSheet, never silent).
 */
export async function discardActiveCookSession(
  session: Pick<ActiveCookSession, "recipeId" | "armedAlarmId">,
): Promise<void> {
  try {
    await cancelStepAlarm(session.armedAlarmId);
  } catch {
    // Best-effort.
  }
  try {
    await stopCookNotification();
  } catch {
    // Best-effort.
  }
  try {
    await AsyncStorage.removeItem(
      `${COOK_SESSION_PREFIX}${session.recipeId}`,
    );
  } catch {
    // Best-effort.
  }
}

/**
 * Re-post the sticky Android notification for a live session after a cold
 * start (an OEM force-stop or reboot-equivalent kill can take the row down
 * with the process). For a paused session the dead interval counts as
 * paused, so the baked frozen body matches the screen's frozen elapsed.
 * No-op on iOS / Expo Go (startCookNotification degrades). Never throws.
 */
export async function repostActiveCookNotification(
  session: ActiveCookSession,
  t: TranslateFn,
): Promise<void> {
  if (!session.title) return;
  try {
    const now = Date.now();
    await startCookNotification({
      recipeTitle: session.title,
      recipeId: session.recipeId,
      startedAt: session.cookStartAt,
      pausedMs:
        session.status === "paused"
          ? session.pausedMsTotal +
            Math.max(0, now - (session.pausedAt ?? now))
          : session.pausedMsTotal,
      paused: session.status === "paused",
      t,
    });
  } catch {
    // Best-effort.
  }
}
