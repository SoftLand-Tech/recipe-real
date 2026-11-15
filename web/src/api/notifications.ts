/**
 * Notification inbox API + unread badge store — owned by slice ACCOUNT.
 *
 * Ports mobile/src/api/client.ts notifications calls onto the web http layer:
 *   - GET  /notifications       → 20/page newest-first; meta.unread_count
 *                                 drives the badge (mobile's community bell).
 *   - POST /notifications/read  → {ids?: number[]}; without ids, EVERYTHING
 *                                 unread. Server stamps each row once.
 *
 * Poll-on-focus badge: mobile refreshes the bell on tab focus; the web does
 * the same via a module-level store + `useUnreadNotificationCount()` (focus
 * listener + a slow 60s interval). No websockets by contract — the store is
 * in-memory only, so it naturally reads 0 signed-out and leaves nothing to
 * wipe on sign-out/account deletion.
 */
import { useEffect, useSyncExternalStore } from "react";

import { getAuthToken, get, post } from "@/api/http";

import type {
  NotificationActor,
  NotificationRow,
  NotificationType,
  NotificationsPage,
} from "@/api/types";

/** Server-fixed inbox page size (used by the hasMore fallback). */
const NOTIFICATIONS_PER_PAGE = 20;

function toNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Normalize one inbox row defensively (actor/post may be null, types vary). */
function normalizeNotification(row: unknown): NotificationRow {
  const n = (row ?? {}) as Record<string, unknown>;
  const rawActor = n.actor;
  const actor: NotificationActor | null =
    rawActor != null && typeof rawActor === "object"
      ? (() => {
          const a = rawActor as Record<string, unknown>;
          return {
            id: toNum(a.id) ?? 0,
            display_name: typeof a.display_name === "string" ? a.display_name : null,
            avatar_url: typeof a.avatar_url === "string" ? a.avatar_url : null,
          };
        })()
      : null;
  const rawPost = n.post;
  const post =
    rawPost != null && typeof rawPost === "object"
      ? (() => {
          const p = rawPost as Record<string, unknown>;
          return {
            id: toNum(p.id) ?? 0,
            body: typeof p.body === "string" ? p.body : "",
          };
        })()
      : null;
  const rawType = n.type;
  const type: NotificationType =
    rawType === "comment"
      ? "comment"
      : rawType === "moderation"
        ? "moderation"
        : "like";
  const message = n.message;
  return {
    id: toNum(n.id) ?? 0,
    type,
    read_at: typeof n.read_at === "string" ? n.read_at : null,
    created_at: typeof n.created_at === "string" ? n.created_at : "",
    message: typeof message === "string" && message.trim() !== "" ? message : null,
    actor,
    post,
  };
}

/**
 * One page of the signed-in user's inbox (GET /api/notifications). The
 * unread count comes from the response meta (authoritative); hasMore prefers
 * the paginator meta with a full-page heuristic fallback, like mobile.
 */
export async function fetchNotifications(page = 1): Promise<NotificationsPage> {
  const data = await get<{
    data?: unknown;
    meta?: Record<string, unknown>;
  }>("/notifications", { params: { page } });
  const rawRows = Array.isArray(data?.data) ? data.data : [];
  const rows = rawRows.map(normalizeNotification);
  const current = toNum(data?.meta?.current_page) ?? page;
  const last = toNum(data?.meta?.last_page) ?? current;
  return {
    items: rows,
    unreadCount: toNum(data?.meta?.unread_count) ?? 0,
    hasMore: current < last || rows.length >= NOTIFICATIONS_PER_PAGE,
  };
}

/**
 * Mark notifications read (POST /api/notifications/read, authed): with ids,
 * exactly those rows; without, everything unread. The server ignores rows
 * the caller doesn't own and only stamps rows still unread.
 */
export async function markNotificationsRead(ids?: number[]): Promise<void> {
  await post<unknown>("/notifications/read", ids ? { ids } : {});
}

// ---- Unread badge store -------------------------------------------------------
// Module-level (in-memory) store so ANY slice can read the badge count via
// useUnreadNotificationCount() without a provider — other slices opt in by
// mounting the hook; the ACCOUNT inbox page keeps it in sync as the one
// writer besides the poll.

let unreadCount = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Store setter (documented writer for the inbox page's optimistic updates). */
export function setUnreadCount(next: number): void {
  const value = Math.max(0, Math.floor(next));
  if (value === unreadCount) return;
  unreadCount = value;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getUnreadCountSnapshot(): number {
  return unreadCount;
}

/**
 * Poll the unread count once (GET /notifications page 1 → meta.unread_count).
 * Signed-out reads as 0; failures keep the last value (a badge must never
 * turn a flaky network into an error surface).
 */
export async function refreshUnreadCount(): Promise<void> {
  if (!getAuthToken()) {
    setUnreadCount(0);
    return;
  }
  try {
    const page = await fetchNotifications(1);
    setUnreadCount(page.unreadCount);
  } catch {
    // Keep the last known count; the next focus/interval retries.
  }
}

/**
 * The unread badge count, refreshed on window focus + every 60s while
 * mounted. Poll-on-focus is the contract (no websockets). Slices that only
 * need the current value can pass { poll: false }.
 */
export function useUnreadNotificationCount(
  { poll = true }: { poll?: boolean } = {},
): number {
  const count = useSyncExternalStore(subscribe, getUnreadCountSnapshot);

  useEffect(() => {
    void refreshUnreadCount();
    if (!poll) return;
    const onFocus = () => void refreshUnreadCount();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => void refreshUnreadCount(), 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
  }, [poll]);

  return count;
}
