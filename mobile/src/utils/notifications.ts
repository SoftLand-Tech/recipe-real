/**
 * Lazy, crash-safe access to expo-notifications.
 *
 * On Android in Expo Go (SDK 53+) the package THROWS at module evaluation
 * ("remote notifications removed from Expo Go"), which crashed any screen
 * that imported it statically. All access therefore goes through a dynamic
 * import guarded by try/catch: in Expo Go the API resolves to null and
 * callers degrade gracefully; dev-client and store builds get the real API.
 */
import type * as NotificationsTypes from "expo-notifications";

import {
  getLastOsNotifGranted,
  getRawNudgePref,
  setLastOsNotifGranted,
  setNudgePref,
  type NudgePref,
} from "@/utils/prefs";

type NotificationsApi = typeof NotificationsTypes;

let apiPromise: Promise<NotificationsApi | null> | null = null;

export function notificationsApi(): Promise<NotificationsApi | null> {
  if (!apiPromise) {
    apiPromise = import("expo-notifications").catch((error) => {
      console.warn("[RecipeReal] expo-notifications unavailable:", error);
      return null;
    });
  }
  return apiPromise;
}

export async function isNotificationsAvailable(): Promise<boolean> {
  return (await notificationsApi()) != null;
}

/** Configure the foreground notification handler; no-op when unavailable. */
export async function setupNotificationHandler(): Promise<void> {
  const api = await notificationsApi();
  if (!api) return;
  api.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function isPermissionGranted(
  status: NotificationsTypes.NotificationPermissionsStatus,
  api: NotificationsApi,
): boolean {
  if (status.granted) return true;
  const iosStatus = status.ios?.status;
  return (
    iosStatus === api.IosAuthorizationStatus?.PROVISIONAL ||
    iosStatus === api.IosAuthorizationStatus?.EPHEMERAL
  );
}

/** Current permission status; false when the API is unavailable. */
export async function notificationsGranted(): Promise<boolean> {
  const api = await notificationsApi();
  if (!api) return false;
  try {
    return isPermissionGranted(await api.getPermissionsAsync(), api);
  } catch {
    return false;
  }
}

/**
 * Ensure permission, prompting the user when needed.
 * Persists `nudgePref = "on"` whenever permission is granted so Settings
 * reflects the active permission immediately.
 * Returns false when unavailable, blocked or denied.
 */
export async function requestNotificationsPermission(): Promise<boolean> {
  const api = await notificationsApi();
  if (!api) return false;
  try {
    const current = await api.getPermissionsAsync();
    if (isPermissionGranted(current, api)) {
      await setNudgePref("on");
      await setLastOsNotifGranted(true);
      return true;
    }
    if (!current.canAskAgain) {
      await setLastOsNotifGranted(false);
      return false;
    }
    const next = await api.requestPermissionsAsync();
    const granted = isPermissionGranted(next, api);
    if (granted) {
      await setNudgePref("on");
      await setLastOsNotifGranted(true);
    } else {
      await setLastOsNotifGranted(false);
    }
    return granted;
  } catch {
    return false;
  }
}

let syncChain: Promise<NudgePref> = Promise.resolve("off");

async function runSyncNudgePrefWithPermission(): Promise<NudgePref> {
  const [raw, lastOsGranted, granted] = await Promise.all([
    getRawNudgePref(),
    getLastOsNotifGranted(),
    notificationsGranted(),
  ]);

  if (granted) {
    // Auto-enable when never explicitly turned off (raw === null) or when OS
    // permission transitioned from denied -> granted (e.g. via OS Settings).
    if (raw === null || (lastOsGranted === false && raw !== "on")) {
      await setNudgePref("on");
      await setLastOsNotifGranted(true);
      return "on";
    }
    if (lastOsGranted !== true) {
      await setLastOsNotifGranted(true);
    }
    return raw === "on" ? "on" : "off";
  }

  if (lastOsGranted !== false) {
    await setLastOsNotifGranted(false);
  }
  if (raw === "on") {
    await setNudgePref("off");
  }
  return "off";
}

/**
 * Reconcile the saved nudge preference with the current OS notification
 * permission. Serialized to prevent concurrent mount/focus/AppState calls
 * from racing AsyncStorage reads and writes.
 */
export function syncNudgePrefWithPermission(): Promise<NudgePref> {
  const next = syncChain.then(
    () => runSyncNudgePrefWithPermission(),
    () => runSyncNudgePrefWithPermission(),
  );
  syncChain = next;
  return next;
}

/** Schedule a notification `minutes` from now; returns the id, or null when
 *  unavailable. `data` rides along for tap-to-open routing (see deepLink). */
export async function scheduleMinuteNotification(
  title: string,
  body: string,
  minutes: number,
  data?: Record<string, string>,
): Promise<string | null> {
  const api = await notificationsApi();
  if (!api || !(minutes > 0)) return null;
  try {
    return await api.scheduleNotificationAsync({
      content: { title, body, ...(data ? { data } : null) },
      trigger: {
        type: api.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(minutes * 60),
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

/** Cancel a scheduled notification; never throws. */
export async function cancelNotification(id: string | null): Promise<void> {
  if (!id) return;
  const api = await notificationsApi();
  if (!api) return;
  try {
    await api.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or cancelled — nothing to do.
  }
}

/** Upper clamp for planned (absolute-time) notification delays: ~3 hours. */
const MAX_PLAN_DELAY_MS = 3 * 60 * 60 * 1000;

/**
 * Schedule a notification at an ABSOLUTE time (the start-time planner's step
 * boundaries). The delay is `at - now`, clamped to ~3h out; a boundary already
 * in the past (delay < 0) or an unavailable API resolves to null so callers
 * can skip it. Never throws.
 */
export async function scheduleAtNotification(
  title: string,
  body: string,
  at: Date,
  data?: Record<string, string>,
): Promise<string | null> {
  const api = await notificationsApi();
  if (!api) return null;
  const delayMs = at.getTime() - Date.now();
  if (delayMs < 0) return null;
  try {
    return await api.scheduleNotificationAsync({
      content: { title, body, ...(data ? { data } : null) },
      trigger: {
        type: api.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.round(Math.min(delayMs, MAX_PLAN_DELAY_MS) / 1000),
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

/** Cancel every notification id in the list (planned plans/steps); never throws. */
export async function cancelPlannedNotifications(
  ids: (string | null)[],
): Promise<void> {
  await Promise.all(ids.map((id) => cancelNotification(id)));
}

// ---- Tap-to-open ------------------------------------------------------------
// Tapping a scheduled notification used to just dismiss it. Every schedule
// helper above accepts a `data` payload; this listener + the cold-start
// reader below route taps to their screen via deepLink (same targets as
// the notifee cook/alarm taps in cookAlarms.ts).

/** Tap payload handler: receives the notification's `data`, never throws. */
export type NotificationTapHandler = (data: unknown) => void;

const noopUnsubscribe = () => {};

/**
 * Listen for notification taps while the app is alive. Resolves to an
 * unsubscribe function (a no-op when the API is unavailable, e.g. Expo Go).
 */
export async function addNotificationTapListener(
  onTap: NotificationTapHandler,
): Promise<() => void> {
  const api = await notificationsApi();
  if (!api) return noopUnsubscribe;
  try {
    const sub = api.addNotificationResponseReceivedListener((response) => {
      try {
        onTap(response.notification.request.content.data);
      } catch {
        // A tap must never crash the app.
      }
    });
    return () => {
      try {
        sub.remove();
      } catch {
        // Already removed.
      }
    };
  } catch {
    return noopUnsubscribe;
  }
}

/**
 * The tap that opened a killed app, if any: returns the notification's id +
 * `data` payload, else null. Called once from _layout at cold start. The id
 * lets the caller skip taps it already consumed (the OS keeps reporting the
 * last tap otherwise, which would re-navigate on every later launch).
 */
export async function getColdStartNotificationData(): Promise<{
  id: string;
  data: unknown;
} | null> {
  const api = await notificationsApi();
  if (!api) return null;
  try {
    const response = await api.getLastNotificationResponseAsync();
    if (!response) return null;
    return {
      id: response.notification.request.identifier,
      data: response.notification.request.content.data ?? null,
    };
  } catch {
    return null;
  }
}
