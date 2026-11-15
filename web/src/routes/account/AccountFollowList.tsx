/**
 * Followers / following lists (shared impl, ACCOUNT slice).
 *
 * Web twin of mobile's follow-list screen, split across the two public
 * routes /u/:id/followers and /u/:id/following. The tab pair persists as
 * links between the two routes (same affordance as mobile's tabs, but each
 * tab is its own URL on the web). Rows link to the user's public profile.
 *
 * NOTE (deliberate): rows do NOT carry per-row follow buttons. The backend
 * follow lists (UserPublicResource via FollowController) never populate
 * followed_by_me — only the profile endpoint reports is_following — so a
 * per-row button would render a wrong state. The follow action lives on
 * /u/:id where the state is real. (Mobile does the same.)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { fetchFollowers, fetchFollowing } from "@/api/follow";
import { AccountAvatar } from "@/components/AccountAvatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { cn } from "@/utils/cn";
import { useT } from "@/i18n";

import type { PublicProfile } from "@/api/types";

export type FollowListMode = "followers" | "following";

export function AccountFollowList({ mode }: { mode: FollowListMode }) {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const userId = id != null ? Number(id) : NaN;
  const validId = Number.isFinite(userId) && userId > 0;

  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // Monotonic request id: only the LATEST load may commit, so a slow page
  // response can never clobber newer state (mobile's requestId pattern).
  const requestIdRef = useRef(0);

  /**
   * Initial page inline in the effect (await-first IIFE: no synchronous
   * setState); retries re-trigger it by bumping the tick. Rows replace on
   * success, and the requestId guard keeps a slow response from clobbering
   * a newer one (mobile's requestId pattern).
   */
  const [reloadTick, setReloadTick] = useState(0);
  useEffect(() => {
    if (!validId) return;
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    void (async () => {
      try {
        const result =
          mode === "followers"
            ? await fetchFollowers(userId, 1)
            : await fetchFollowing(userId, 1);
        if (cancelled || requestId !== requestIdRef.current) return;
        setUsers(result.users);
        setPage(1);
        setHasMore(result.hasMore);
        setLoadFailed(false);
      } catch {
        if (cancelled || requestId !== requestIdRef.current) return;
        // A failed load must not render as "empty list" — keep them distinct.
        setLoadFailed(true);
        setHasMore(false);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [validId, userId, mode, reloadTick]);

  /** First-page retry from an event — flips the skeleton back on safely. */
  const retry = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    setReloadTick((tick) => tick + 1);
  }, []);

  /** Load-more entry from an event: spinner first, then the fetch. */
  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const requestId = ++requestIdRef.current;
    try {
      const result =
        mode === "followers"
          ? await fetchFollowers(userId, page + 1)
          : await fetchFollowing(userId, page + 1);
      if (requestId !== requestIdRef.current) return;
      setUsers((prev) => [
        ...prev,
        ...result.users.filter((row) => !prev.some((other) => other.id === row.id)),
      ]);
      setPage((value) => value + 1);
      setHasMore(result.hasMore);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setLoadFailed(false);
      setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [loadingMore, userId, mode, page]);

  const title = mode === "followers" ? t("follow.followersTitle") : t("follow.followingTitle");
  const emptyText =
    mode === "followers" ? t("follow.noFollowers") : t("follow.noFollowing");

  if (!validId) {
    // Malformed :id — nothing to fetch; failed card without retry.
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
          {title}
        </h1>
        <Card className="mt-5 px-6 py-12 text-center">
          <p className="font-body text-[15px] text-muted">{t("follow.loadFailed")}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
          {title}
        </h1>
        <Link
          to={`/u/${id ?? ""}`}
          className="rounded-pill px-3 py-1.5 font-body text-[14px] font-bold text-muted transition-colors hover:text-orange-deep"
        >
          {t("follow.viewProfile")}
        </Link>
      </div>

      {/* Tab pair: the two routes themselves. */}
      <div
        role="tablist"
        aria-label={title}
        className="mt-4 inline-flex gap-1 rounded-pill border border-hair bg-cream-deep p-1"
      >
        {(
          [
            { to: "followers", label: t("follow.followersTitle"), key: "followers" },
            { to: "following", label: t("follow.followingTitle"), key: "following" },
          ] as const
        ).map((tab) => (
          <Link
            key={tab.key}
            to={`/u/${id ?? ""}/${tab.to}`}
            role="tab"
            aria-selected={mode === tab.key}
            className={cn(
              "rounded-pill px-5 py-2 font-body text-[13.5px] font-bold transition-colors",
              mode === tab.key
                ? "bg-orange text-white shadow-[var(--shadow-btn)]"
                : "text-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="mt-5 space-y-2.5" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <Card key={i} className="flex items-center gap-4 p-4">
              <Skeleton circle className="h-11 w-11" />
              <Skeleton className="h-4 w-40" />
            </Card>
          ))}
        </div>
      ) : loadFailed ? (
        <Card className="mt-5 flex flex-col items-center gap-4 px-6 py-12 text-center">
          <p className="font-body text-[15px] text-muted">{t("follow.loadFailed")}</p>
          <Button type="button" onClick={retry}>
            {t("common.retry")}
          </Button>
        </Card>
      ) : users.length === 0 ? (
        <div className="mt-5">
          <EmptyState title={emptyText} />
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-2.5">
            {users.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/u/${row.id}`}
                  className="flex items-center gap-4 rounded-card border border-hair bg-white px-4 py-3.5 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-orange hover:shadow-[var(--shadow-card-hover)]"
                >
                  <AccountAvatar name={row.display_name ?? row.name} url={row.avatar_url} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-body text-[15px] font-bold text-ink">
                    {(row.display_name ?? row.name ?? "").trim() || "?"}
                  </span>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-[18px] w-[18px] shrink-0 text-faint rtl:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-5 flex justify-center">
              <Button
                type="button"
                variant="ghost"
                loading={loadingMore}
                disabled={loadingMore}
                onClick={loadMore}
              >
                {t("follow.loadMore")}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
