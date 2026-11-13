import { useEffect } from "react";
import { AppState, InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useT } from "@/i18n";
import {
  consumePendingNotifNav,
  getColdStartCookTarget,
  initGlobalCookEvents,
} from "@/utils/cookAlarms";
import {
  addNotificationTapListener,
  getColdStartNotificationData,
  setupNotificationHandler,
  syncNudgePrefWithPermission,
} from "@/utils/notifications";
import {
  navigateNotificationTarget,
  notificationDataToHref,
  parseStoredHref,
  type NotificationHref,
} from "@/utils/deepLink";
import {
  readActiveCookSession,
  repostActiveCookNotification,
} from "@/utils/cookSessionStatus";

/**
 * Headless notification plumbing, mounted once inside the providers (see
 * _layout). Renders nothing. On mount it:
 *
 * 1. Configures the expo-notifications foreground handler (previously never
 *    called anywhere — taps had no listener at all).
 * 2. Registers the global notifee listeners (quick actions + body taps)
 *    plus the foreground-service task (sticky cook notification).
 * 3. Listens for expo-notification taps while alive → deep link.
 * 4. Resolves cold-start taps (killed app opened via a notification, from
 *    either system) → deep link, exactly once per tap (consumed tap ids
 *    are remembered so later launches don't re-navigate).
 * 5. Re-posts the sticky cook notification when a live session survived
 *    the kill without it (OEM force-stop).
 *
 * While alive it also consumes headless-tap destinations stashed by the
 * notifee background handler whenever the app foregrounds.
 */
const SEEN_TAP_KEY = "recipereal.seenNotifTap";
const SEEN_TAP_TTL_MS = 5 * 60 * 1000;

async function alreadyConsumed(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_TAP_KEY);
    if (!raw) return false;
    const seen = JSON.parse(raw) as { id?: unknown; at?: unknown };
    return (
      seen.id === id &&
      typeof seen.at === "number" &&
      Date.now() - seen.at < SEEN_TAP_TTL_MS
    );
  } catch {
    return false;
  }
}

async function markConsumed(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SEEN_TAP_KEY,
      JSON.stringify({ id, at: Date.now() }),
    );
  } catch {
    // Best-effort.
  }
}

async function navigateOnce(id: string, href: NotificationHref, source: string): Promise<void> {
  if (await alreadyConsumed(id)) return;
  await markConsumed(id);
  navigateNotificationTarget(href, source);
}

export function NotificationSetup() {
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    let unsubExpo: (() => void) | null = null;
    initGlobalCookEvents();

    (async () => {
      // Parallelize notification handler setup, tap listener registration,
      // permission/preference sync, and cold-start tap queries so boot doesn't
      // pay them sequentially.
      const [, , listenerUnsub, cookTarget, expoTap, pending] = await Promise.all([
        setupNotificationHandler().catch(() => undefined),
        syncNudgePrefWithPermission().catch(() => undefined),
        addNotificationTapListener((data) => {
          const href = notificationDataToHref(data);
          if (href) navigateNotificationTarget(href, "expo-tap");
        }).catch(() => null),
        getColdStartCookTarget().catch(() => null),
        getColdStartNotificationData().catch(() => null),
        consumePendingNotifNav().catch(() => null),
      ]);

      if (cancelled) {
        try {
          listenerUnsub?.();
        } catch {
          // Already removed.
        }
        return;
      }
      unsubExpo = listenerUnsub;

      // Cold-start taps: notifee (cook/alarm) + expo (planner) + any
      // headless body-tap stash, first hit wins.
      try {
        if (pending) {
          const href = parseStoredHref(pending);
          if (href) navigateNotificationTarget(href, "pending-tap");
        } else if (cookTarget) {
          await navigateOnce(`notifee:${cookTarget.id}`, cookTarget.href, "cold-start");
        } else if (expoTap) {
          const href = notificationDataToHref(expoTap.data);
          if (href) await navigateOnce(`expo:${expoTap.id}`, href, "cold-start");
        }
      } catch {
        // Taps are best-effort; the app still boots normally.
      }
    })().catch(() => {
      // Startup plumbing must never break boot.
    });

    // Defer the sticky-repost check until initial animations/interactions settle
    // so it doesn't compete with splash and first-frame rendering.
    const repostTask = InteractionManager.runAfterInteractions(() => {
      if (cancelled) return;
      readActiveCookSession()
        .then((session) => {
          if (!cancelled && session) {
            return repostActiveCookNotification(session, t);
          }
        })
        .catch(() => {
          // Best-effort.
        });
    });

    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void syncNudgePrefWithPermission().catch(() => undefined);
      consumePendingNotifNav()
        .then((href) => {
          if (!href) return;
          const parsed = parseStoredHref(href);
          if (parsed) navigateNotificationTarget(parsed, "pending-tap");
        })
        .catch(() => {
          // Best-effort.
        });
    });
    return () => {
      cancelled = true;
      repostTask.cancel();
      try {
        unsubExpo?.();
      } catch {
        // Already removed.
      }
      appStateSub.remove();
    };
    // Mount-once: t is stable, and re-running would double-register.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
