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
const ACTIVE_COOK_POINTER_KEY = "recipereal.activeCookRecipeId";
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * In-memory cache + in-flight dedupe for the active cook session so
 * navigation changes in ActiveCookBanner don't re-scan AsyncStorage.
 * `undefined` = not loaded yet; `null` = confirmed no active session.
 */
let cachedSession: ActiveCookSession | null | undefined = undefined;
let inFlightRead: Promise<ActiveCookSession | null> | null = null;

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

async function parseCookSessionRaw(raw: string): Promise<ActiveCookSession | null> {
  const parsed: unknown = JSON.parse(raw);
  if (!isActiveSnapshot(parsed)) return null;
  const snapshotTitle =
    typeof (parsed as { title?: unknown }).title === "string" &&
    (parsed as { title: string }).title !== ""
      ? (parsed as { title: string }).title
      : null;
  let session: ActiveCookSession = {
    recipeId: parsed.recipeId,
    title: snapshotTitle,
    cookStartAt: parsed.cookStartAt,
    pausedAt: typeof parsed.pausedAt === "number" ? parsed.pausedAt : null,
    pausedMsTotal:
      typeof parsed.pausedMsTotal === "number" ? parsed.pausedMsTotal : 0,
    status: parsed.status,
    armedAlarmId:
      typeof parsed.armedAlarmId === "string" ? parsed.armedAlarmId : null,
  };
  if (!session.title) {
    // v1 snapshot (no embedded title): resolve offline, else untitled.
    try {
      const cached = await getCachedRecipe(session.recipeId);
      if (cached) session = { ...session, title: cached.title };
    } catch {
      // Offline cache unreadable — banner still shows, untitled.
    }
  }
  return session;
}

async function readSessionByRecipeId(
  recipeId: number,
): Promise<ActiveCookSession | null> {
  try {
    const raw = await AsyncStorage.getItem(`${COOK_SESSION_PREFIX}${recipeId}`);
    if (raw == null) return null;
    return await parseCookSessionRaw(raw);
  } catch {
    return null;
  }
}

export interface ReadActiveCookSessionOptions {
  /** Bypass the in-memory cache (e.g. after returning from a cook screen). */
  force?: boolean;
  /** Optional recipeId hint (avoids `getAllKeys()` when the pointer isn't set yet). */
  hintRecipeId?: number;
}

/**
 * The most recently started live session, if any. Uses an in-memory cache
 * and the `recipereal.activeCookRecipeId` pointer so navigations avoid
 * scanning `AsyncStorage.getAllKeys()`, falling back to `cook-session:*`
 * discovery only when the pointer is absent. Title resolves from the
 * snapshot itself (v2+) with an offline recipe-cache lookup fallback (v1).
 * Never throws — null means "no banner".
 */
export async function readActiveCookSession(
  opts?: ReadActiveCookSessionOptions,
): Promise<ActiveCookSession | null> {
  const force = opts?.force === true;
  if (!force && cachedSession !== undefined) {
    return cachedSession;
  }
  if (!force && inFlightRead) {
    return inFlightRead;
  }

  const run = (async (): Promise<ActiveCookSession | null> => {
    try {
      const pointerRaw = await AsyncStorage.getItem(ACTIVE_COOK_POINTER_KEY);
      if (pointerRaw != null) {
        const pointerId = Number(pointerRaw);
        if (Number.isFinite(pointerId) && pointerId > 0) {
          const pointed = await readSessionByRecipeId(pointerId);
          if (pointed) {
            cachedSession = pointed;
            return pointed;
          }
          // Pointer is stale (session expired or cleared directly on cook screen).
          void AsyncStorage.removeItem(ACTIVE_COOK_POINTER_KEY).catch(() => {});
          if (
            opts?.hintRecipeId != null &&
            Number.isFinite(opts.hintRecipeId) &&
            opts.hintRecipeId !== pointerId
          ) {
            const hinted = await readSessionByRecipeId(opts.hintRecipeId);
            if (hinted) {
              void AsyncStorage.setItem(
                ACTIVE_COOK_POINTER_KEY,
                String(hinted.recipeId),
              ).catch(() => {});
              cachedSession = hinted;
              return hinted;
            }
          }
          cachedSession = null;
          return null;
        }
      }

      if (opts?.hintRecipeId != null && Number.isFinite(opts.hintRecipeId)) {
        const hinted = await readSessionByRecipeId(opts.hintRecipeId);
        if (hinted) {
          void AsyncStorage.setItem(
            ACTIVE_COOK_POINTER_KEY,
            String(hinted.recipeId),
          ).catch(() => {});
          cachedSession = hinted;
          return hinted;
        }
        cachedSession = null;
        return null;
      }

      // Pointer absent (e.g. legacy cook-session:* key): scan once and promote.
      const keys = await AsyncStorage.getAllKeys();
      const cookKeys = keys.filter((k) => k.startsWith(COOK_SESSION_PREFIX));
      if (cookKeys.length === 0) {
        cachedSession = null;
        return null;
      }
      const entries = await AsyncStorage.multiGet(cookKeys);
      let bestRaw: string | null = null;
      let bestStart = -1;
      for (const [, raw] of entries) {
        if (raw == null) continue;
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!isActiveSnapshot(parsed)) continue;
          if (parsed.cookStartAt <= bestStart) continue;
          bestStart = parsed.cookStartAt;
          bestRaw = raw;
        } catch {
          // Corrupt snapshot — the cook screen drops it on mount.
        }
      }
      const best = bestRaw != null ? await parseCookSessionRaw(bestRaw) : null;
      if (best) {
        void AsyncStorage.setItem(
          ACTIVE_COOK_POINTER_KEY,
          String(best.recipeId),
        ).catch(() => {});
      }
      cachedSession = best;
      return best;
    } catch {
      return null;
    }
  })().finally(() => {
    if (inFlightRead === run) inFlightRead = null;
  });

  inFlightRead = run;
  return run;
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
  cachedSession = null;
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
    await AsyncStorage.multiRemove([
      `${COOK_SESSION_PREFIX}${session.recipeId}`,
      ACTIVE_COOK_POINTER_KEY,
    ]);
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
