import { router } from "expo-router";

import { track } from "@/analytics";

/**
 * Deep-link routing for notification taps (system notifications only — the
 * in-app inbox navigates directly). Both notifee (cook session + step
 * alarms) and expo-notifications (planner nudges) funnel here so a tap
 * always lands on the content instead of just dismissing the row.
 *
 * `router.navigate` is used deliberately: when the destination already sits
 * in the history it goes BACK to it (no duplicate cook screens); otherwise
 * it pushes. Never throws — readiness races at cold start are retried.
 */

const MAX_NAV_ATTEMPTS = 8;
const NAV_RETRY_MS = 400;

/** Every screen a notification tap can land on (typed-route safe). */
export type NotificationHref = `/cook/${number}` | `/recipe/${number}`;

/** Best-effort navigation that survives cold-start races; never throws. */
export function navigateNotificationTarget(
  href: NotificationHref,
  source: string,
): void {
  track("notification_opened", { href: String(href), source });
  let attempts = 0;
  const attempt = () => {
    attempts++;
    try {
      router.navigate(href);
      return;
    } catch {
      // Navigation not ready yet (cold start) — retry a few times.
      if (attempts < MAX_NAV_ATTEMPTS) {
        setTimeout(attempt, NAV_RETRY_MS);
      }
    }
  };
  attempt();
}

/**
 * Map a notification data payload to its deep link. Cook + alarm payloads
 * come from notifee (`data` on the notification); plan payloads from
 * expo-notifications (`content.data`). Null when the payload is unusable.
 */
export function notificationDataToHref(data: unknown): NotificationHref | null {
  if (data == null || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const recipeId = Number(d.recipeId);
  if (!Number.isFinite(recipeId) || recipeId <= 0) return null;
  if (d.kind === "cook" || d.kind === "alarm") return `/cook/${recipeId}`;
  if (d.kind === "plan") return `/recipe/${recipeId}`;
  return null;
}

/**
 * Validate a stashed href string back into a typed deep link (the pending
 * tap stash persists plain strings). Null when malformed.
 */
export function parseStoredHref(raw: string): NotificationHref | null {
  const m = /^\/(cook|recipe)\/(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const id = Number(m[2]);
  if (!Number.isFinite(id) || id <= 0) return null;
  return m[1] === "cook" ? `/cook/${id}` : `/recipe/${id}`;
}
