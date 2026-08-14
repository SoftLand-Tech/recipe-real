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

/** Current permission status; false when the API is unavailable. */
export async function notificationsGranted(): Promise<boolean> {
  const api = await notificationsApi();
  if (!api) return false;
  try {
    return (await api.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Ensure permission, prompting the user when needed.
 * Returns false when unavailable, blocked or denied.
 */
export async function requestNotificationsPermission(): Promise<boolean> {
  const api = await notificationsApi();
  if (!api) return false;
  try {
    const current = await api.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await api.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Schedule a notification `minutes` from now; returns the id, or null when
 *  unavailable. */
export async function scheduleMinuteNotification(
  title: string,
  body: string,
  minutes: number,
): Promise<string | null> {
  const api = await notificationsApi();
  if (!api || !(minutes > 0)) return null;
  try {
    return await api.scheduleNotificationAsync({
      content: { title, body },
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
