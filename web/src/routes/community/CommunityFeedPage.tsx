/**
 * Community feed (/community) — slice COMMUNITY.
 *
 * Public read (works signed-out): sort chips (suggested / latest / trending —
 * exactly the sorts the API serves), a Facebook-style composer entry card,
 * then the post cards with optimistic likes. Infinite load-more via an
 * IntersectionObserver sentinel; skeletons, empty and error states; 429 and
 * network failures surface as friendly toasts (never a crash).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import {
  fetchMyProfileForCommunity,
  fetchPosts,
  type CommunityMyProfile,
} from "@/api/community";
import { isOfflineError, isRateLimitedError } from "@/api/http";
import type { Post, PostSort } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/auth/AuthContext";
import { useT } from "@/i18n";
import { CommunityAvatar } from "@/routes/community/CommunityAvatar";
import { CommunityPostCard } from "@/routes/community/CommunityPostCard";

type LoadState = "loading" | "ready" | "error";

/** localStorage key persisting the chosen feed sort across visits. */
const SORT_PREF_KEY = "rr_community_sort";

const SORT_OPTIONS: { value: PostSort; labelKey: string }[] = [
  { value: "suggested", labelKey: "community.sortSuggested" },
  { value: "latest", labelKey: "community.sortLatest" },
  { value: "trending", labelKey: "community.sortTrending" },
];

function readStoredSort(): PostSort {
  try {
    const v = localStorage.getItem(SORT_PREF_KEY);
    return v === "latest" || v === "trending" || v === "suggested" ? v : "suggested";
  } catch {
    return "suggested";
  }
}

export default function CommunityFeedPage() {
  const t = useT();
  const navigate = useNavigate();
  const { status } = useAuth();
  const toast = useToast();

  const [sort, setSort] = useState<PostSort>(readStoredSort);
  const [posts, setPosts] = useState<Post[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [me, setMe] = useState<CommunityMyProfile | null>(null);

  /** Sort of the newest issued fetch — stale responses are dropped. */
  const feedKeyRef = useRef<PostSort>(sort);
  const reqSeqRef = useRef(0);

  const fetchPage = useCallback(
    async (targetPage: number, sortOverride?: PostSort) => {
      const activeSort = sortOverride ?? feedKeyRef.current;
      const feedKey = activeSort;
      const requestId = ++reqSeqRef.current;
      feedKeyRef.current = feedKey;
      // NOTE: no synchronous setState before the first await — this runs from
      // a mount effect (react-hooks/set-state-in-effect); callers own any
      // pre-flight loading flips (the initial state / handlers already do).
      try {
        const result = await fetchPosts(targetPage, activeSort);
        if (feedKeyRef.current !== feedKey || requestId !== reqSeqRef.current) {
          return;
        }
        if (targetPage === 1) {
          setPosts(result.posts);
        } else {
          setPosts((prev) => [
            ...prev,
            ...result.posts.filter((p) => !prev.some((q) => q.id === p.id)),
          ]);
        }
        setPage(targetPage);
        setHasMore(result.hasMore);
        setState("ready");
      } catch (error) {
        if (feedKeyRef.current !== feedKey || requestId !== reqSeqRef.current) {
          return;
        }
        if (isRateLimitedError(error)) {
          toast.error(t("common.rateLimited"));
        } else if (isOfflineError(error)) {
          toast.error(t("common.offline"));
        }
        if (targetPage === 1) setState("error");
      } finally {
        setLoadingMore(false);
      }
    },
    [t, toast],
  );

  // Cold load: page 1 of the persisted sort.
  useEffect(() => {
    void fetchPage(1, sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Own profile (avatar for the composer card + own-post menus), best-effort.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (status !== "authed") {
        // Off the synchronous effect path (react-hooks/set-state-in-effect).
        await Promise.resolve();
        if (!cancelled) setMe(null);
        return;
      }
      try {
        const profile = await fetchMyProfileForCommunity();
        if (!cancelled) setMe(profile);
      } catch {
        // Non-fatal: cards just won't show the own-post menu.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const changeSort = useCallback(
    (next: PostSort) => {
      if (next === feedKeyRef.current) return;
      setSort(next);
      setPosts([]);
      setPage(1);
      setHasMore(false);
      setState("loading");
      try {
        localStorage.setItem(SORT_PREF_KEY, next);
      } catch {
        // Best-effort persistence.
      }
      void fetchPage(1, next);
    },
    [fetchPage],
  );

  /** Mirror like changes into the feed rows (survives card prop syncs). */
  const applyLikeState = useCallback(
    (postId: number, liked: boolean, likesCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, liked_by_me: liked, likes_count: likesCount } : p,
        ),
      );
    },
    [],
  );

  /** Drop a post after its own deletion or an author block. */
  const removePost = useCallback((postId: number) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // Infinite load-more: the sentinel enters the viewport → next page.
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (state !== "ready" || loadingMore || !hasMore) return;
    // Pre-flight flip lives here (observer callback / click context), so
    // fetchPage itself stays free of synchronous setState.
    setLoadingMore(true);
    void fetchPage(page + 1);
  }, [state, loadingMore, hasMore, page, fetchPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || state !== "ready") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, state, loadMore]);

  const composeTarget = status === "anon" ? "/login" : "/community/compose";
  const myName = me ? (me.display_name ?? me.name ?? "").trim() : "";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-5">
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-semibold leading-tight text-ink">
          {t("community.pageTitle")}
        </h1>
      </header>

      {/* Sort chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("community.sortLabel")}>
        {SORT_OPTIONS.map(({ value, labelKey }) => (
          <Chip
            key={value}
            label={t(labelKey)}
            active={sort === value}
            onClick={() => changeSort(value)}
          />
        ))}
      </div>

      {/* Composer entry card (Facebook-style) */}
      <Card className="mb-4 flex items-center gap-3 p-3">
        <CommunityAvatar name={myName || "?"} uri={me?.avatar_url} size={36} />
        <Link
          to={composeTarget}
          className="min-w-0 flex-1 truncate rounded-pill bg-cream-deep px-4 py-2.5 font-body text-[14.5px] text-faint transition-colors hover:bg-orange-soft hover:text-muted"
        >
          {status === "anon" ? t("community.signInPrompt") : t("community.compose")}
        </Link>
        <Link
          to={composeTarget}
          aria-label={t("community.addImages")}
          title={t("community.addImages")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-cream-deep text-orange transition-colors hover:bg-orange-soft"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="14" rx="3" />
            <path d="M3.5 15.5l4.5-4 3.5 3 4-4.5 5 5.5" />
            <circle cx="9" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
          </svg>
        </Link>
      </Card>

      {/* Feed */}
      {state === "loading" && posts.length === 0 ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t("common.loading")}>
          {[0, 1, 2].map((k) => (
            <Card key={k} className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Skeleton circle className="h-10 w-10" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-44 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : null}

      {state === "error" && posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-hair bg-white px-6 py-14 text-center shadow-[var(--shadow-card)]">
          <h2 className="font-display text-xl font-semibold text-ink">
            {t("common.error")}
          </h2>
          <p className="max-w-sm font-body text-[15px] text-muted">
            {t("community.loadFailed")}
          </p>
          <Button
            onClick={() => {
              setState("loading");
              void fetchPage(1);
            }}
          >
            {t("common.retry")}
          </Button>
        </div>
      ) : null}

      {state === "ready" && posts.length === 0 ? (
        <EmptyState
          title={t("community.emptyTitle")}
          body={t("community.emptyBody")}
          action={
            <Button onClick={() => navigate(composeTarget)}>
              {t("community.emptyBeFirst")}
            </Button>
          }
        />
      ) : null}

      {posts.length > 0 ? (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <CommunityPostCard
              key={post.id}
              post={post}
              myUserId={me?.id ?? null}
              variant="feed"
              onLikeState={applyLikeState}
              onRemove={removePost}
            />
          ))}
        </div>
      ) : null}

      {/* Load-more sentinel + footer */}
      {state === "ready" && hasMore ? (
        <div ref={sentinelRef} className="flex justify-center py-6">
          {loadingMore ? (
            <Skeleton className="h-6 w-6 rounded-full" />
          ) : (
            <button
              type="button"
              onClick={loadMore}
              className="rounded-pill px-4 py-2 font-body text-[13.5px] font-bold text-muted transition-colors hover:text-orange-deep"
            >
              {t("community.loadMore")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
