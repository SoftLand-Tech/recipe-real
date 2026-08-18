/**
 * Cook Mode alarm/notification wrapper around @notifee/react-native.
 *
 * Notifee is a NATIVE module: in Expo Go its JS side throws at module
 * evaluation ("Notifee native module not found"), so every access goes
 * through a dynamic import guarded by try/catch. In Expo Go the API
 * resolves to null and every export here degrades to a silent no-op —
 * the in-app stopwatch keeps working, alarms/persistent notifications
 * just skip. Dev-client and store builds get the real behavior.
 */
import { Platform } from "react-native";

import { translate, type TranslateFn } from "@/i18n";

type NotifeeModule = typeof import("@notifee/react-native");
type NotifeeApi = NotifeeModule["default"];

/** Fallback translator (English) when a caller doesn't supply one. */
const tEn: TranslateFn = (key, params) => translate("en", key, params);

let modPromise: Promise<NotifeeModule | null> | null = null;

/** Lazily import the whole notifee namespace (api + enums); null in Expo Go. */
export function notifeeModule(): Promise<NotifeeModule | null> {
  if (!modPromise) {
    modPromise = import("@notifee/react-native").catch((error) => {
      console.warn(
        "[RecipeReal] notifee unavailable (Expo Go / web):",
        error instanceof Error ? error.message : error,
      );
      return null;
    });
  }
  return modPromise;
}

/** The notifee API object; null in Expo Go / on web. */
export async function notifeeApi(): Promise<NotifeeApi | null> {
  const mod = await notifeeModule();
  return mod?.default ?? null;
}

/** Whether alarms/persistent notifications can be used at all. */
export async function alarmAvailable(): Promise<boolean> {
  return (await notifeeApi()) != null;
}

/**
 * Request notification permission via notifee. Returns false when the API
 * is unavailable (Expo Go) or the user denied / can no longer be asked.
 */
export async function requestAlarmPermission(): Promise<boolean> {
  const api = await notifeeApi();
  if (!api) return false;
  try {
    const settings = await api.requestPermission();
    // > 0 covers AUTHORIZED and PROVISIONAL (see notifee docs).
    return settings.authorizationStatus > 0;
  } catch {
    return false;
  }
}

// ---- Channels ---------------------------------------------------------------

const COOK_CHANNEL_ID = "cook";
const ALARM_CHANNEL_ID = "alarm";
/** Accent used for the colorized persistent notification background. */
const ACCENT = "#BF552B";
/** Long vibration pattern (ms) for step alarms. */
const ALARM_VIBRATION_PATTERN = [400, 500, 400, 500, 400, 500];

let channelsPromise: Promise<void> | null = null;

/** Create the cook + alarm channels once per app run; never throws. */
function ensureChannels(mod: NotifeeModule): Promise<void> {
  if (!channelsPromise) {
    channelsPromise = mod.default
      .createChannels([
        {
          id: COOK_CHANNEL_ID,
          name: "Cooking session",
          importance: mod.AndroidImportance.HIGH,
        },
        {
          id: ALARM_CHANNEL_ID,
          name: "Step alarms",
          importance: mod.AndroidImportance.HIGH,
          sound: "default",
          vibration: true,
          vibrationPattern: ALARM_VIBRATION_PATTERN,
        },
      ])
      .catch(() => {
        // Channels may already exist or the API may reject — best effort.
        channelsPromise = null;
      });
  }
  return channelsPromise;
}

// ---- Persistent cooking-session notification (Android only) -----------------

/** Stable notification id so pause/resume re-posts replace the same row. */
export const COOK_NOTIFICATION_ID = "cook-session";

/** Quick-action ids used by the persistent notification's buttons. */
export const COOK_ACTION_PAUSE = "cook-pause";
export const COOK_ACTION_RESUME = "cook-resume";
export const COOK_ACTION_FINISH = "cook-finish";

export interface StartCookNotificationOpts {
  recipeTitle: string;
  recipeId: number;
  /** Wall-clock ms when the stopwatch started. */
  startedAt: number;
  /** Accumulated paused ms BEFORE this post (grows on resume). */
  pausedMs: number;
  paused: boolean;
  /** Translator for the notification copy (defaults to English). */
  t?: TranslateFn;
}

/**
 * Module mirror of the last posted cook notification. Background quick
 * actions (headless JS, no React state) re-post from this snapshot; if the
 * OS killed the app it is stale/empty and the actions degrade to
 * cancel-only (documented v1 limitation).
 */
let cookNotifState: StartCookNotificationOpts | null = null;
/** When the notification was last flipped paused<->running (wall ms). */
let cookNotifToggledAt = 0;

/**
 * Post/refresh the Android ongoing "cooking session" notification with a
 * chronometer whose base (`timestamp: startedAt + pausedMs`) reflects the
 * pause-adjusted elapsed. Re-posting on pause/resume swaps the action title
 * (Pause <-> Resume) and the base; while paused the OS chronometer keeps
 * ticking visually and snaps back to the correct elapsed on the next
 * re-post — Android notification chronometers cannot truly freeze.
 * iOS: silently skipped (returns false). Never throws.
 */
export async function startCookNotification(
  opts: StartCookNotificationOpts,
): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const mod = await notifeeModule();
  if (!mod) return false;
  const t = opts.t ?? tEn;
  try {
    await ensureChannels(mod);
    cookNotifState = opts;
    cookNotifToggledAt = Date.now();
    await mod.default.displayNotification({
      id: COOK_NOTIFICATION_ID,
      title: t("cook.cookNotifTitle", { title: opts.recipeTitle }),
      body: t("cook.cookNotifBody"),
      android: {
        channelId: COOK_CHANNEL_ID,
        ongoing: true,
        showTimestamp: false,
        showChronometer: true,
        // Chronometer base = start + paused-so-far, so the ticker shows the
        // pause-adjusted elapsed (see the pause-drift note above).
        timestamp: opts.startedAt + opts.pausedMs,
        color: ACCENT,
        colorized: true,
        smallIcon: "ic_launcher",
        actions: [
          {
            // Single action whose title/id flips via re-post.
            title: opts.paused
              ? t("cook.actionResume")
              : t("cook.actionPause"),
            pressAction: {
              id: opts.paused ? COOK_ACTION_RESUME : COOK_ACTION_PAUSE,
            },
          },
          {
            title: t("cook.actionFinish"),
            pressAction: { id: COOK_ACTION_FINISH },
          },
        ],
      },
    });
    return true;
  } catch (error) {
    console.warn("[RecipeReal] startCookNotification failed:", error);
    return false;
  }
}

/** Cancel the persistent cook notification; never throws. */
export async function stopCookNotification(): Promise<void> {
  cookNotifState = null;
  const api = await notifeeApi();
  if (!api) return;
  try {
    await api.cancelNotification(COOK_NOTIFICATION_ID);
  } catch {
    // Already gone — nothing to do.
  }
}

// ---- Step alarms --------------------------------------------------------------

export interface StepAlarmOpts {
  recipeTitle: string;
  stepNumber: number;
  minutes: number;
  /** Absolute fire time; defaults to now + minutes. */
  at?: Date;
  /** Translator for the alarm copy (defaults to English). */
  t?: TranslateFn;
}

/**
 * Schedule a real alarm notification (channel "alarm", HIGH importance,
 * default sound + long vibration). `fullScreenAction` is intentionally NOT
 * set: it requires a registered mainComponent and misconfigures easily.
 * Returns the notification id, or null when unavailable/denied (Expo Go).
 */
export async function scheduleStepAlarm(
  opts: StepAlarmOpts,
): Promise<string | null> {
  const mod = await notifeeModule();
  if (!mod || !(opts.minutes > 0)) return null;
  const t = opts.t ?? tEn;
  const fireAt =
    opts.at?.getTime() ?? Date.now() + opts.minutes * 60_000;
  try {
    await ensureChannels(mod);
    return await mod.default.createTriggerNotification(
      {
        title: opts.recipeTitle,
        body: t("cook.alarmBody", {
          n: opts.stepNumber,
          minutes: opts.minutes,
        }),
        android: {
          channelId: ALARM_CHANNEL_ID,
          smallIcon: "ic_launcher",
        },
      },
      {
        type: mod.TriggerType.TIMESTAMP,
        timestamp: fireAt,
      },
    );
  } catch (error) {
    console.warn("[RecipeReal] scheduleStepAlarm failed:", error);
    return null;
  }
}

/** Cancel a scheduled step alarm; never throws. */
export async function cancelStepAlarm(id: string | null): Promise<void> {
  if (!id) return;
  const api = await notifeeApi();
  if (!api) return;
  try {
    await api.cancelNotification(id);
  } catch {
    // Already fired or cancelled — nothing to do.
  }
}

// ---- Quick-action event wiring ------------------------------------------------

export interface CookEventHandlers {
  /** Pause/resume toggle pressed (foreground quick action). */
  onPauseToggle: () => void;
  /** Finish pressed (foreground quick action). */
  onFinish: () => void;
}

/**
 * Wire the notification quick actions to the given handlers:
 * - Foreground (app visible): notifee.onForegroundEvent -> the SAME pause/
 *   resume/finish handlers the on-screen buttons use.
 * - Background (app backgrounded or killed): notifee.onBackgroundEvent —
 *   best-effort v1. When the app is merely backgrounded the module mirror
 *   of the notification is still alive, so pause/resume re-posts the
 *   notification with the flipped action + refreshed chronometer base;
 *   finish cancels it. When the OS KILLED the app that mirror is gone (the
 *   headless JS starts fresh), so pause/resume can only no-op and finish
 *   still cancels the notification — the cook session itself is NOT
 *   submitted in that case.
 *
 * Returns an unsubscribe function for the foreground listener.
 */
export function initCookEventHandlers(handlers: CookEventHandlers): () => void {
  let unsubscribe: (() => void) | null = null;
  let disposed = false;

  notifeeModule()
    .then((mod) => {
      if (!mod || disposed) return;
      unsubscribe = mod.default.onForegroundEvent(({ type, detail }) => {
        if (type !== mod.EventType.ACTION_PRESS) return;
        const id = detail.pressAction?.id;
        if (id === COOK_ACTION_PAUSE || id === COOK_ACTION_RESUME) {
          handlers.onPauseToggle();
        } else if (id === COOK_ACTION_FINISH) {
          handlers.onFinish();
        }
      });

      mod.default.onBackgroundEvent(async ({ type, detail }) => {
        if (type !== mod.EventType.ACTION_PRESS) return;
        const id = detail.pressAction?.id;
        try {
          if (id === COOK_ACTION_FINISH) {
            await stopCookNotification();
          } else if (
            (id === COOK_ACTION_PAUSE || id === COOK_ACTION_RESUME) &&
            cookNotifState != null
          ) {
            // Flip the module mirror and re-post so the notification at
            // least shows the right action + chronometer base.
            const paused = id === COOK_ACTION_PAUSE;
            const now = Date.now();
            const prev = cookNotifState;
            const next: StartCookNotificationOpts = {
              ...prev,
              paused,
              pausedMs: paused
                ? prev.pausedMs
                : prev.pausedMs + Math.max(0, now - cookNotifToggledAt),
            };
            await startCookNotification(next);
          }
        } catch {
          // Best-effort: background quick actions must never crash.
        }
      });
    })
    .catch(() => {
      // Expo Go — no quick actions exist to wire.
    });

  return () => {
    disposed = true;
    try {
      unsubscribe?.();
    } catch {
      // Listener already gone.
    }
  };
}
