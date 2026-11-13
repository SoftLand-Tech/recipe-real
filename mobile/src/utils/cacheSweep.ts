import AsyncStorage from "@react-native-async-storage/async-storage";
import { InteractionManager } from "react-native";

import { CACHE_SWEPT_AT_KEY, refreshCacheLight } from "@/db/database";

/**
 * Single-flight guard around the light cache refresh. Home and Browse both
 * used to fire `refreshCacheLight()` on mount (up to 10 sequential × 100-row
 * fetch+upsert passes), competing with each other and with the UI exactly
 * when the user first opens the app. Both call sites now route through
 * `maybeSweepCache()`, which runs the sweep AT MOST once per hour — guarded
 * in-memory within a session and across restarts via AsyncStorage (and
 * stamped by `seedCacheFirstPage`/`seedCacheRemainingPages` so Browse opening
 * right after Home seeded skips the redundant sweep).
 */

const SWEEP_MIN_INTERVAL_MS = 60 * 60 * 1000;

let inFlight: Promise<void> | null = null;
let lastSweepAt = 0;

function waitForInteractions(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => resolve());
  });
}

export function maybeSweepCache(): Promise<void> {
  if (inFlight) return inFlight;
  if (Date.now() - lastSweepAt < SWEEP_MIN_INTERVAL_MS) return Promise.resolve();

  inFlight = (async () => {
    await waitForInteractions();
    if (Date.now() - lastSweepAt < SWEEP_MIN_INTERVAL_MS) return;

    const persisted = Number(await AsyncStorage.getItem(CACHE_SWEPT_AT_KEY)) || 0;
    lastSweepAt = Math.max(lastSweepAt, persisted);
    if (Date.now() - lastSweepAt < SWEEP_MIN_INTERVAL_MS) return;

    await refreshCacheLight();
    lastSweepAt = Date.now();
    await AsyncStorage.setItem(CACHE_SWEPT_AT_KEY, String(lastSweepAt));
  })()
    .catch((error) => {
      // A failed sweep must not stamp the clock — the next call retries.
      console.warn("[RecipeReal] cache sweep failed:", error);
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
