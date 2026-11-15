/**
 * Notification inbox (/notifications, authed) — OWNED BY SLICE ACCOUNT.
 *
 * Web twin of mobile's notifications screen: likes/comments on your posts
 * (plus moderator notices), 20/page newest-first, unread rows highlighted
 * with the orange dot. Nothing is marked read automatically — only an
 * explicit row open (that row) or "Mark all read". The unread count flows
 * through the shared store in api/notifications.ts so any other slice can
 * surface the same badge via useUnreadNotificationCount().
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  fetchNotifications,
  markNotificationsRead,
  setUnreadCount,
  useUnreadNotificationCount,
} from "@/api/notifications";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useT, type TranslateFn } from "@/i18n";

import type { NotificationRow } from "@/api/types";

type LoadState = "loading" | "ready" | "error";

/** Compact relative time, localized (mobile's rel.* vocabulary, web namespace). */
function relativeDate(t: TranslateFn, iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return t("notifications.relNow");
  if (mins < 60) return t("notifications.relMinutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("notifications.relHoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("notifications.relDaysAgo", { n: days });
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return t("notifications.relWeeksAgo", { n: weeks });
  const months = Math.floor(days / 30);
  if (months < 12) return t("notifications.relMonthsAgo", { n: months });
  try {
    return new Date(then).toLocaleDateString();
  } catch {
    return "";
  }
}

/** Row body text per type (mobile semantics incl. actor-deleted fallbacks). */
function rowText(t: TranslateFn, row: NotificationRow): string {
  const name =
    row.actor != null
      ? (row.actor.display_name ?? "").trim() || t("notifications.someone")
      : t("notifications.someone");
  if (row.type === "moderation") {
    return row.message ?? t("notifications.moderationDefault");
  }
  if (row.type === "like") {
    return t("notifications.likedYourPost", { name });
  }
  const snippet = (row.post?.body ?? "").trim().slice(0, 60);
  if (snippet.length > 0) {
    return t("notifications.commented", {
      name,
      snippet:
        (row.post?.body ?? "").trim().length > 60 ? `${snippet}…` : snippet,
    });
  }
  // Comment on a post that was since deleted — keep the sentence natural.
  return t("notifications.commentedYourPost", { name });
}

function TypeGlyph({ type }: { type: NotificationRow["type"] }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (type === "like") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[11px] w-[11px]" {...common}>
        <path d="M12 20C6 15.5 3 12.6 3 9.2 3 6.9 4.8 5 7.2 5c1.8 0 3.3 1 4.8 3 1.5-2 3-3 4.8-3C19.2 5 21 6.9 21 9.2c0 3.4-3 6.3-9 10.8Z" />
      </svg>
    );
  }
  if (type === "moderation") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[11px] w-[11px]" {...common}>
        <path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
        <path d="m8.8 12 2.2 2.2 4.4-4.4" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[11px] w-[11px]" {...common}>
      <path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.4-4.2A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

/**
 * Row leading visual: the actor's avatar (initials tile fallback) with a
 * tiny type badge pinned to its corner; a neutral person glyph stands in
 * when the actor deleted their account.
 */
function RowAvatar({ row }: { row: NotificationRow }) {
  return (
    <span className="relative inline-flex shrink-0">
      {row.actor != null ? (
        <AccountAvatar
          name={row.actor.display_name}
          url={row.actor.avatar_url}
          px={40}
        />
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-deep text-muted">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <circle cx="12" cy="8" r="3.5" />
            <path d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5" />
          </svg>
        </span>
      )}
      <span
        className={
          row.type === "moderation"
            ? "absolute -bottom-0.5 -end-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-white bg-dark text-white"
            : "absolute -bottom-0.5 -end-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-white bg-orange-soft text-orange-deep"
        }
      >
        <TypeGlyph type={row.type} />
      </span>
    </span>
  );
}

export default function NotificationsPage() {
  const t = useT();
  const toast = useToast();
  const navigate = useNavigate();
  const unread = useUnreadNotificationCount({ poll: false });

  const [state, setState] = useState<LoadState>("loading");
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const itemsRef = useRef<NotificationRow[]>([]);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Initial page inline in the effect (await-first IIFE: no synchronous
  // setState); retries re-trigger it by bumping the tick.
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchNotifications(1);
        if (cancelled) return;
        setItems(result.items);
        setUnreadCount(result.unreadCount);
        setPage(1);
        setHasMore(result.hasMore);
        setState("ready");
      } catch {
        if (cancelled) return;
        if (itemsRef.current.length === 0) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);

  /** First-page retry from an event — flips the skeleton back on safely. */
  const retryFirstPage = useCallback(() => {
    setState((prev) => (prev === "error" ? "loading" : prev));
    setReloadTick((tick) => tick + 1);
  }, []);

  /** Load-more entry from an event: spinner first, then the fetch. */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const result = await fetchNotifications(page + 1);
      setItems((prev) => [
        ...prev,
        ...result.items.filter((row) => !prev.some((other) => other.id === row.id)),
      ]);
      setPage((value) => value + 1);
      setHasMore(result.hasMore);
    } catch {
      // Footer retry affordance instead of looping doomed fetches.
      setLoadMoreFailed(true);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, page]);

  /** Row open: mark that row read (optimistic) and go to the post. */
  const handleOpen = useCallback(
    (row: NotificationRow) => {
      if (row.read_at == null) {
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((item) => (item.id === row.id ? { ...item, read_at: now } : item)),
        );
        setUnreadCount(Math.max(0, unread - 1));
        markNotificationsRead([row.id]).catch(() => {
          // Non-fatal: a later mark-all or re-open retries it.
        });
      }
      if (row.post != null) {
        navigate(`/post/${row.post.id}`);
      } else if (row.type === "moderation") {
        // The notice text is already the row body — nothing to open.
      } else {
        toast.show(t("notifications.postGone"));
      }
    },
    [navigate, unread, t, toast],
  );

  /** Mark all read: stamp locally, sync best-effort. */
  const handleMarkAll = useCallback(async () => {
    if (unread === 0 || markingAll) return;
    setMarkingAll(true);
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => (item.read_at == null ? { ...item, read_at: now } : item)),
    );
    setUnreadCount(0);
    try {
      await markNotificationsRead();
    } catch {
      // Non-fatal: the next visit re-syncs from the server.
    } finally {
      setMarkingAll(false);
    }
  }, [unread, markingAll]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
          {t("notifications.pageTitle")}
        </h1>
        {state === "ready" && unread > 0 ? (
          <button
            type="button"
            onClick={() => void handleMarkAll()}
            disabled={markingAll}
            className="rounded-pill px-3 py-1.5 font-body text-[13.5px] font-bold text-orange-deep transition-colors hover:bg-orange-soft disabled:opacity-55"
          >
            {t("notifications.markAllRead")}
          </button>
        ) : null}
      </div>

      {state === "loading" ? (
        <div className="mt-5 space-y-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} className="flex items-center gap-3 p-4">
              <Skeleton circle className="h-9 w-9" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </Card>
          ))}
        </div>
      ) : state === "error" ? (
        <Card className="mt-5 flex flex-col items-center gap-4 px-6 py-14 text-center">
          <h2 className="font-display text-[1.5rem] font-semibold text-ink">
            {t("common.error")}
          </h2>
          <p className="font-body text-[15px] text-muted">
            {t("notifications.loadFailed")}
          </p>
          <Button type="button" onClick={retryFirstPage}>
            {t("common.retry")}
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title={t("notifications.empty")}
            body={t("notifications.emptyCaption")}
          />
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {items.map((row) => {
              const unreadRow = row.read_at == null;
              const rel = relativeDate(t, row.created_at);
              const inner = (
                <>
                  {unreadRow ? (
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange"
                    />
                  ) : null}
                  <RowAvatar row={row} />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-body text-[14.5px] font-semibold leading-snug text-ink">
                      {rowText(t, row)}
                    </span>
                    {rel !== "" ? (
                      <span className="mt-0.5 block font-body text-[12px] text-faint">
                        {rel}
                      </span>
                    ) : null}
                  </span>
                </>
              );
              const className = unreadRow
                ? "flex items-center gap-3 rounded-card border border-hair bg-cream-deep px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:border-orange"
                : "flex items-center gap-3 rounded-card border border-hair bg-white px-4 py-3.5 shadow-[var(--shadow-card)] transition-colors hover:border-orange";
              return (
                <li key={row.id}>
                  {row.post != null ? (
                    <Link
                      to={`/post/${row.post.id}`}
                      className={className}
                      onClick={() => handleOpen(row)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={`${className} w-full text-start`}
                      onClick={() => handleOpen(row)}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {loadingMore ? (
            <div className="mt-4 flex justify-center py-2">
              <Skeleton className="h-4 w-24" />
            </div>
          ) : loadMoreFailed ? (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="ghost" onClick={loadMore}>
                {t("common.retry")}
              </Button>
            </div>
          ) : hasMore ? (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {t("notifications.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
