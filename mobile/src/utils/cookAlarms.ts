/**
 * Cook Mode alarm/notification wrapper around @notifee/react-native.
 *
 * Notifee is a NATIVE module: in Expo Go its JS side throws at module
 * evaluation ("Notifee native module not found"), so every access goes
 * through a dynamic import guarded by try/catch. In Expo Go the API
 * resolves to null and every export here degrades to a silent no-op —
 * the in-app stopwatch keeps working, alarms/persistent notifications
 * just skip. Dev-client and store builds get the real behavior.
 *
 * System notifications CANNOT be tested in Expo Go at all (expo-notifications
 * is likewise unavailable there) — tap-to-open, the sticky session
 * notification and step alarms all need a dev build or APK.
 */
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { translate, type TranslateFn } from "@/i18n";
import {
  getRawNudgePref,
  setLastOsNotifGranted,
  setNudgePref,
} from "@/utils/prefs";
import {
  navigateNotificationTarget,
  notificationDataToHref,
  type NotificationHref,
} from "@/utils/deepLink";

type NotifeeModule = typeof import("@notifee/react-native");
type NotifeeApi = NotifeeModule["default"];

/** Fallback translator (English) when a caller doesn't supply one. */
const tEn: TranslateFn = (key, params) => translate("en", key, params);

/**
 * Format an elapsed duration (ms) for display: `M:SS` under an hour,
 * `H:MM:SS` at/over an hour (a 65-minute cook used to read "65:00").
 * Pure — shared by the in-app stopwatch and the frozen notification body.
 */
export function formatCookElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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
    const granted = settings.authorizationStatus > 0;
    if (granted) {
      await setNudgePref("on");
      await setLastOsNotifGranted(true);
    } else {
      await setLastOsNotifGranted(false);
      if ((await getRawNudgePref()) === "on") {
        await setNudgePref("off");
      }
    }
    return granted;
  } catch {
    return false;
  }
}

/**
 * requestAlarmPermission() + a localized explanation when it fails.
 * Callers used to drop the denial silently, which read as a bug (a chip
 * that does nothing). Returns the same boolean: true → alarms may arm.
 */
export async function ensureAlarmPermissionOrExplain(
  t: TranslateFn,
): Promise<boolean> {
  const granted = await requestAlarmPermission();
  if (!granted) {
    Alert.alert(t("alarm.permissionTitle"), t("alarm.permissionBody"));
  }
  return granted;
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
 * Module mirror of the last posted cook notification (recipe + title), so
 * background/headless quick actions can re-post it after an OS kill wiped
 * the in-memory state. Written on every post, cleared with the
 * notification. The full session truth (pauses, visits, status) lives in
 * the cook screen's `cook-session:{id}` snapshot — this is only the display
 * row the notification needs.
 */
const COOK_NOTIF_META_KEY = "recipereal.cookNotifMeta";

interface CookNotifMeta {
  recipeId: number;
  title: string;
}

async function writeCookNotifMeta(meta: CookNotifMeta): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_NOTIF_META_KEY, JSON.stringify(meta));
  } catch {
    // Best-effort.
  }
}

async function readCookNotifMeta(): Promise<CookNotifMeta | null> {
  try {
    const raw = await AsyncStorage.getItem(COOK_NOTIF_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookNotifMeta>;
    if (
      typeof parsed.recipeId !== "number" ||
      !Number.isFinite(parsed.recipeId) ||
      typeof parsed.title !== "string"
    ) {
      return null;
    }
    return { recipeId: parsed.recipeId, title: parsed.title };
  } catch {
    return null;
  }
}

/** Stashed deep-link for a notification body tap handled while headless. */
const PENDING_NOTIF_NAV_KEY = "recipereal.pendingNotifNav";

/**
 * Stash a notification-tap destination for the app layer: a headless
 * (background/killed) tap cannot navigate, but the tap opens the app, and
 * _layout consumes this on foreground to complete the navigation.
 */
export async function stashPendingNotifNav(href: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_NOTIF_NAV_KEY,
      JSON.stringify({ href, at: Date.now() }),
    );
  } catch {
    // Best-effort.
  }
}

/** Single-shot consume of the stashed tap destination (null when none). */
export async function consumePendingNotifNav(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_NOTIF_NAV_KEY);
    await AsyncStorage.removeItem(PENDING_NOTIF_NAV_KEY).catch(() => {});
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { href?: unknown; at?: unknown };
    // Stale taps (older than a day, e.g. never consumed) are dropped.
    if (
      typeof parsed.href !== "string" ||
      typeof parsed.at !== "number" ||
      Date.now() - parsed.at > 24 * 60 * 60 * 1000
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Post/refresh the Android ongoing "cooking session" notification with a
 * chronometer whose base (`timestamp: startedAt + pausedMs`) reflects the
 * pause-adjusted elapsed. Re-posting on pause/resume swaps the action title
 * (Pause <-> Resume) and the base.
 *
 * Stickiness: `ongoing` keeps the row non-dismissible while the process is
 * alive. The foreground-service elevation (`asForegroundService`) was
 * REMOVED on purpose: on Android 14+ notifee's merged service is
 * shortService-typed and posts fail without the FOREGROUND_SERVICE_*
 * typed permission — a plain ongoing notification is correct. Aggressive
 * OEM force-stops or swipe-aways can still clear the row — the in-app
 * session banner then remains the source of truth, and the notification
 * is re-posted on next launch.
 *
 * Paused state does NOT show a ticking chronometer: Android notification
 * chronometers cannot freeze, and leaving one running while paused would
 * display ever-growing time that isn't real cooking time. Instead the
 * paused post hides the chronometer and bakes the frozen pause-adjusted
 * elapsed into the body text, so the notification shows the truth and
 * snaps back to the live ticker on resume.
 *
 * Tapping the notification BODY opens the cook screen: an explicit
 * `pressAction: { id: "default" }` plus a `data` payload route through the
 * global tap handler (see initGlobalCookEvents).
 *
 * iOS: silently skipped (returns false). Ongoing notifications with
 * chronometers + quick actions are an Android-only construct here; on iOS
 * the in-app stopwatch is the timer (no OS countdown is posted, so nothing
 * drifts or lies — the paused/finished state is purely in-app). Never throws.
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
    await writeCookNotifMeta({ recipeId: opts.recipeId, title: opts.recipeTitle });
    // Frozen elapsed baked into the paused body (computed at post time —
    // static text can't drift, which is exactly what "paused" means).
    const pausedBody = opts.paused
      ? `${t("cook.cookNotifBody")} · ${formatCookElapsed(Date.now() - opts.startedAt - opts.pausedMs)}`
      : t("cook.cookNotifBody");
    await mod.default.displayNotification({
      id: COOK_NOTIFICATION_ID,
      title: t("cook.cookNotifTitle", { title: opts.recipeTitle }),
      body: pausedBody,
      data: { kind: "cook", recipeId: String(opts.recipeId) },
      android: {
        channelId: COOK_CHANNEL_ID,
        ongoing: true,
        // FGS removed - Android 14 shortService cap; timing is wall-clock
        // and alarms fire regardless.
        // Body tap → global handler opens the cook screen.
        pressAction: { id: "default" },
        showTimestamp: false,
        // Live ticker while running; hidden while paused (see above).
        showChronometer: !opts.paused,
        // Chronometer base = start + paused-so-far, so the ticker shows the
        // pause-adjusted elapsed. Ignored while paused (chronometer hidden).
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
  await AsyncStorage.removeItem(COOK_NOTIF_META_KEY).catch(() => {
    // Best-effort.
  });
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
  recipeId: number;
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
 * Returns the notification id — or `exactAlarmDenied: true` when Android
 * 14+ refused SCHEDULE_EXACT_ALARM (the OS "Alarms & reminders" settings
 * screen must be opened once; see openAlarmPermissionSettings).
 */
export interface StepAlarmResult {
  id: string | null;
  exactAlarmDenied: boolean;
}

export async function scheduleStepAlarm(
  opts: StepAlarmOpts,
): Promise<StepAlarmResult> {
  const mod = await notifeeModule();
  if (!mod || !(opts.minutes > 0)) {
    return { id: null, exactAlarmDenied: false };
  }
  const t = opts.t ?? tEn;
  const fireAt =
    opts.at?.getTime() ?? Date.now() + opts.minutes * 60_000;
  try {
    await ensureChannels(mod);
    const id = await mod.default.createTriggerNotification(
      {
        title: opts.recipeTitle,
        body: t("cook.alarmBody", {
          n: opts.stepNumber,
          minutes: opts.minutes,
        }),
        // Body tap opens the cook screen (global tap handler routes it).
        data: {
          kind: "alarm",
          recipeId: String(opts.recipeId),
          stepNumber: String(opts.stepNumber),
        },
        android: {
          channelId: ALARM_CHANNEL_ID,
          smallIcon: "ic_launcher",
          pressAction: { id: "default" },
        },
      },
      {
        type: mod.TriggerType.TIMESTAMP,
        timestamp: fireAt,
      },
    );
    return { id, exactAlarmDenied: false };
  } catch (error) {
    console.warn("[RecipeReal] scheduleStepAlarm failed:", error);
    // Android 12+ refuses exact-alarm triggers when the user hasn't granted
    // SCHEDULE_EXACT_ALARM (denied by DEFAULT for new installs on 14+).
    // Matched by EXACT code equality — never substring — then confirmed
    // against the OS setting, which is authoritative: native error codes
    // vary across notifee/OS versions, the setting does not.
    const rawCode = (error as { code?: unknown })?.code;
    const code =
      typeof rawCode === "string" ? rawCode.trim().toLowerCase() : "";
    if (EXACT_ALARM_DENIED_CODES.has(code)) {
      return { id: null, exactAlarmDenied: true };
    }
    const allowed = await canScheduleExactAlarms();
    return { id: null, exactAlarmDenied: allowed === false };
  }
}

/**
 * Known notifee/OS error codes meaning "exact alarm refused"
 * (SCHEDULE_EXACT_ALARM not granted). Compared by exact equality after
 * lowercase+trim. This list is a fast path only — an unrecognized code
 * falls through to the authoritative canScheduleExactAlarms() check.
 */
const EXACT_ALARM_DENIED_CODES: ReadonlySet<string> = new Set([
  "exact_alarms_not_permitted",
  "alarm_permission_denied",
  "schedule_exact_alarm_denied",
  "android_alarm_denied",
]);

/**
 * Ask the OS whether exact-alarm triggers can currently be scheduled, via
 * notifee's getNotificationSettings().android.alarm ("whether triggers can
 * be created"; pre-Android-12 this reports ENABLED). Returns null when the
 * answer is unknowable (non-Android, Expo Go, NOT_SUPPORTED) — callers must
 * treat null as "don't nag", not as denial.
 */
export async function canScheduleExactAlarms(): Promise<boolean | null> {
  if (Platform.OS !== "android") return null;
  const mod = await notifeeModule();
  if (!mod) return null;
  try {
    const settings = await mod.default.getNotificationSettings();
    const alarm = settings?.android?.alarm;
    if (alarm == null) return null;
    if (alarm === mod.AndroidNotificationSetting.NOT_SUPPORTED) return null;
    return alarm === mod.AndroidNotificationSetting.ENABLED;
  } catch {
    return null;
  }
}

/**
 * Open the Android "Alarms & reminders" special-app-access screen, where
 * the user grants SCHEDULE_EXACT_ALARM (Android 14+ revokes it by default
 * for new installs). No-op when the API is unavailable.
 */
export async function openAlarmPermissionSettings(): Promise<void> {
  const mod = await notifeeModule();
  if (!mod) return;
  try {
    await mod.default.openAlarmPermissionSettings();
  } catch {
    // Older Android without the special-access screen — nothing to open.
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

/**
 * Cancel every notification AND scheduled trigger (delivered + pending
 * steps). No-op when the API is unavailable; a failure is logged, never
 * thrown (callers use it as wholesale cleanup).
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  const api = await notifeeApi();
  if (!api) return;
  try {
    await api.cancelAllNotifications();
  } catch (error) {
    console.warn("[RecipeReal] cancelAllNotifications failed:", error);
  }
}

// ---- Global event wiring (app start, NOT cook-screen mount) -------------------

export interface CookEventHandlers {
  /** Pause/resume toggle pressed (foreground quick action). */
  onPauseToggle: () => void;
  /** Finish pressed (foreground quick action). */
  onFinish: () => void;
}

/**
 * Live in-app handlers, registered by the Cook Mode screen while mounted.
 * The global listeners below prefer them (same handlers as the on-screen
 * buttons); when the screen isn't mounted — backgrounded, or killed and
 * revived headless — the snapshot-backed fallback applies the toggle to the
 * persisted session instead, so Pause/Resume keep working from the shade.
 */
let liveHandlers: CookEventHandlers | null = null;

export function setLiveCookHandlers(handlers: CookEventHandlers | null): void {
  liveHandlers = handlers;
}

/** Minimal structural read of the cook screen's persisted snapshot. */
interface SnapshotPause {
  from: number;
  to: number | null;
}

interface CookSnapshot {
  recipeId: number;
  title?: string;
  cookStartAt: number;
  pausedAt: number | null;
  pausedMsTotal: number;
  pauses: SnapshotPause[];
  status: string;
}

const COOK_SNAPSHOT_PREFIX = "cook-session:";
const MAX_SNAPSHOT_AGE_MS = 24 * 60 * 60 * 1000;

function isFreshSnapshot(value: unknown): value is CookSnapshot {
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

/** Read one persisted session (exact recipe when known, else most recent). */
async function readCookSnapshot(recipeId?: number): Promise<CookSnapshot | null> {
  try {
    if (recipeId != null && Number.isFinite(recipeId)) {
      const raw = await AsyncStorage.getItem(`${COOK_SNAPSHOT_PREFIX}${recipeId}`);
      if (raw != null) {
        const parsed: unknown = JSON.parse(raw);
        if (isFreshSnapshot(parsed)) return parsed;
      }
      return null;
    }
    const keys = await AsyncStorage.getAllKeys();
    let best: CookSnapshot | null = null;
    for (const key of keys) {
      if (!key.startsWith(COOK_SNAPSHOT_PREFIX)) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw == null) continue;
        const parsed: unknown = JSON.parse(raw);
        if (
          isFreshSnapshot(parsed) &&
          (best == null || parsed.cookStartAt > best.cookStartAt)
        ) {
          best = parsed;
        }
      } catch {
        // Corrupt snapshot — skipped (the cook screen drops it on mount).
      }
    }
    return best;
  } catch {
    return null;
  }
}

async function writeCookSnapshot(snap: CookSnapshot, extra: Record<string, unknown>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(
      `${COOK_SNAPSHOT_PREFIX}${snap.recipeId}`,
    );
    if (raw == null) return;
    const current: unknown = JSON.parse(raw);
    if (current == null || typeof current !== "object") return;
    await AsyncStorage.setItem(
      `${COOK_SNAPSHOT_PREFIX}${snap.recipeId}`,
      JSON.stringify({ ...(current as Record<string, unknown>), ...extra }),
    );
  } catch {
    // Best-effort.
  }
}

/** Re-post the ongoing notification from a snapshot (needs a title). */
async function repostFromSnapshot(
  mod: NotifeeModule,
  snap: CookSnapshot,
  t: TranslateFn,
): Promise<void> {
  let title = typeof snap.title === "string" && snap.title !== "" ? snap.title : null;
  if (!title) {
    title = (await readCookNotifMeta())?.title ?? null;
  }
  if (!title) return;
  await startCookNotification({
    recipeTitle: title,
    recipeId: snap.recipeId,
    startedAt: snap.cookStartAt,
    pausedMs:
      snap.status === "paused" && snap.pausedAt != null
        ? snap.pausedMsTotal + Math.max(0, Date.now() - snap.pausedAt)
        : snap.pausedMsTotal,
    paused: snap.status === "paused",
    t,
  });
}

/**
 * Snapshot-backed pause/resume for when the cook screen isn't mounted
 * (backgrounded app, or headless after a kill). Mirrors the screen's toggle
 * math: pausing stamps pausedAt; resuming closes the pause interval and
 * grows pausedMsTotal. The open visit segment keeps accruing wall time —
 * exactly what the screen's own restore does.
 */
async function snapshotTogglePause(recipeId?: number): Promise<void> {
  const mod = await notifeeModule();
  if (!mod) return;
  const snap = await readCookSnapshot(recipeId);
  if (!snap) return;
  const now = Date.now();
  try {
    if (snap.status === "running") {
      await writeCookSnapshot(snap, { status: "paused", pausedAt: now });
      await repostFromSnapshot(mod, { ...snap, status: "paused", pausedAt: now }, tEn);
    } else {
      const from = snap.pausedAt ?? now;
      const pauses = [...snap.pauses, { from, to: now }];
      const pausedMsTotal = snap.pausedMsTotal + Math.max(0, now - from);
      await writeCookSnapshot(snap, {
        status: "running",
        pausedAt: null,
        pausedMsTotal,
        pauses,
      });
      await repostFromSnapshot(
        mod,
        { ...snap, status: "running", pausedAt: null, pausedMsTotal, pauses },
        tEn,
      );
    }
  } catch {
    // Best-effort.
  }
}

type NotifeeEvent = Parameters<
  Parameters<NotifeeModule["default"]["onForegroundEvent"]>[0]
>[0];

/** Route a notification-tap payload (body PRESS) to its screen. */
function handleNotifTap(data: unknown): void {
  const href = notificationDataToHref(data);
  if (href) navigateNotificationTarget(href, "notifee-tap");
}

/**
 * Shared PRESS handler for foreground + background delivery. Quick actions
 * prefer the live cook-screen handlers; the snapshot fallback covers every
 * other state (including headless-after-kill, where the old in-memory
 * mirror used to be empty and Pause/Resume silently no-op'd). Finish with
 * no live screen just cancels the notification — the persisted session
 * stays intact, and the in-app banner guides the user back to finish it
 * properly. Body taps ('default') navigate to the cook screen when the UI
 * is up, or stash the destination for _layout when headless.
 */
async function handleCookPressEvent(
  mod: NotifeeModule,
  event: NotifeeEvent,
  headless: boolean,
): Promise<void> {
  try {
    if (event.type !== mod.EventType.ACTION_PRESS) return;
    const detail = event.detail as
      | { pressAction?: { id?: unknown }; notification?: { data?: unknown } }
      | undefined;
    const actionId = detail?.pressAction?.id;
    const data = detail?.notification?.data;
    if (actionId === COOK_ACTION_PAUSE || actionId === COOK_ACTION_RESUME) {
      if (liveHandlers) liveHandlers.onPauseToggle();
      else await snapshotTogglePause(numericGuard(data));
      return;
    }
    if (actionId === COOK_ACTION_FINISH) {
      if (liveHandlers) liveHandlers.onFinish();
      else await stopCookNotification();
      return;
    }
    if (actionId === "default") {
      if (headless) {
        const href = notificationDataToHref(data);
        if (href) await stashPendingNotifNav(href);
      } else {
        handleNotifTap(data);
      }
    }
  } catch {
    // Best-effort: notification taps must never crash.
  }
}

/** Numeric recipeId out of a tap payload (NaN-safe → undefined). */
function numericGuard(data: unknown): number | undefined {
  if (data == null || typeof data !== "object") return undefined;
  const id = Number((data as Record<string, unknown>).recipeId);
  return Number.isFinite(id) ? id : undefined;
}

let globalEventsInit = false;

/**
 * Register the global notifee listeners ONCE at app start (see _layout):
 * - Foreground PRESS: quick actions → live cook-screen handlers when the
 *   screen is mounted, snapshot fallback otherwise; body taps navigate.
 * - Background PRESS (headless): snapshot-backed pause/resume/finish, and
 *   body taps stash their destination for _layout to consume on foreground.
 * - Foreground-service task registration (legacy no-op: posts stopped
 *   declaring FGS on Android 14 — see startCookNotification; the task
 *   itself resolves immediately).
 *
 * This REPLACES the old per-screen initCookEventHandlers (removed): a
 * screen-mounted listener unsubscribed on unmount AND double-fired while
 * mounted, and its in-memory mirror died with the process.
 */
export function initGlobalCookEvents(): void {
  if (globalEventsInit) return;
  globalEventsInit = true;
  notifeeModule()
    .then((mod) => {
      if (!mod) return;
      try {
        mod.default.registerForegroundService(() => Promise.resolve());
      } catch {
        // Registration is best-effort (kept harmless: no post declares
        // FGS anymore — see startCookNotification).
      }
      try {
        mod.default.onForegroundEvent((event) => {
          void handleCookPressEvent(mod, event, false);
        });
      } catch {
        // Listener registration failed — taps degrade to no-ops.
      }
      try {
        mod.default.onBackgroundEvent((event) =>
          handleCookPressEvent(mod, event, true),
        );
      } catch {
        // Headless actions unavailable — taps degrade to no-ops.
      }
    })
    .catch(() => {
      // Expo Go — no quick actions exist to wire.
    });
}

/**
 * The notification that opened a killed app (cold-start tap), if it was one
 * of ours: returns its id + deep link, else null. Called once from _layout.
 * The id lets the caller skip taps it already consumed (a consumed tap must
 * not re-navigate on every later launch).
 */
export async function getColdStartCookTarget(): Promise<{
  id: string;
  href: NotificationHref;
} | null> {
  const mod = await notifeeModule();
  if (!mod) return null;
  try {
    const initial = await mod.default.getInitialNotification();
    const data = initial?.notification?.data;
    const href = notificationDataToHref(data);
    const id = initial?.notification?.id;
    if (!href || typeof id !== "string") return null;
    return { id, href };
  } catch {
    return null;
  }
}
