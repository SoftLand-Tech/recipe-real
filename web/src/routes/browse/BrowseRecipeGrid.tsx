/**
 * BrowseRecipeGrid — the paginated search-endpoint results grid shared by the
 * Categories / Search / Fridge tabs. OWNED BY SLICE BROWSE.
 *
 * Owns the full page lifecycle so tabs only declare query params:
 *   - reloads page 1 whenever the serialized query changes (300ms debouncing
 *     happens in the parent for typed input);
 *   - "Load more" appends the next page, deduped by id (server pages can
 *     shift slightly between requests — mobile parity);
 *   - a monotonic request id drops stale out-of-order responses;
 *   - load state is DERIVED from a key-stamped result object (no synchronous
 *     setState in the fetch effect — react-hooks v7 contract);
 *   - first-page failure → error card with retry; load-more failure → toast,
 *     keeping the loaded pages (never a crash);
 *   - 429 → the friendly rate-limit toast (contract).
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchSearchPage, SEARCH_PER_PAGE } from "@/api/recipes";
import type { Recipe, SearchParams } from "@/api/types";
import { isRateLimitedError } from "@/api/http";
import { BrowseRecipeCard } from "@/components/BrowseRecipeCard";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n";

/** One settled first-page load, stamped with the query+retry key it answers. */
interface LoadState {
  key: string;
  phase: "ready" | "error";
  items: Recipe[];
  current: number;
  last: number;
  total: number;
}

const GRID_COLS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5";

function GridSkeleton() {
  return (
    <div className={GRID_COLS} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="rounded-card border border-hair bg-white p-3">
          <Skeleton className="aspect-[3/4] w-full rounded-md" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function BrowseRecipeGrid({
  /** Query params (page/perPage are owned by the grid and overridden). */
  params,
  emptyTitle,
  emptyBody,
}: {
  params: SearchParams;
  emptyTitle: string;
  emptyBody?: string;
}) {
  const t = useT();
  // The ToastProvider's api object is referentially stable for the app's
  // lifetime, so it can sit in fetch-effect deps without re-triggering.
  const toast = useToast();

  // Latest-props refs, synced AFTER render (react-hooks/refs contract). The
  // fetch effect below reads params/t through them so a language switch or a
  // parent re-render never restarts an in-flight query.
  const paramsRef = useRef(params);
  const tRef = useRef(t);
  useEffect(() => {
    paramsRef.current = params;
    tRef.current = t;
  });

  // Only the serialized QUERY (and an explicit retry) re-trigger page 1 —
  // object identity changes on every parent render are ignored.
  const queryKey = useMemo(
    () =>
      JSON.stringify({
        q: params.q ?? "",
        category: params.category ?? "",
        maxTime: params.maxTime ?? null,
        sort: params.sort ?? "",
      }),
    [params.q, params.category, params.maxTime, params.sort],
  );

  const [state, setState] = useState<LoadState | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestIdRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const fullKey = `${queryKey}#${retryNonce}`;
  // The settled result for the CURRENT query; null → first page in flight.
  const current = state != null && state.key === fullKey ? state : null;

  // ---- Page 1: (re)load whenever the query changes or retry is pressed ----
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;
    fetchSearchPage({ ...paramsRef.current, page: 1, perPage: SEARCH_PER_PAGE })
      .then((result) => {
        if (!active || requestId !== requestIdRef.current) return;
        setState({
          key: fullKey,
          phase: "ready",
          items: result.recipes,
          current: result.currentPage,
          last: result.lastPage,
          total: result.total,
        });
      })
      .catch((error: unknown) => {
        if (!active || requestId !== requestIdRef.current) return;
        if (isRateLimitedError(error)) {
          toast.error(tRef.current("common.rateLimited"));
        }
        setState({
          key: fullKey,
          phase: "error",
          items: [],
          current: 0,
          last: 0,
          total: 0,
        });
      });
    return () => {
      active = false;
    };
  }, [fullKey, toast]);

  // ---- Load more: append the next page, deduped by id ----------------------
  const handleLoadMore = async () => {
    if (current == null || loadingMoreRef.current || current.current >= current.last) {
      return;
    }
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const requestId = ++requestIdRef.current;
    try {
      const result = await fetchSearchPage({
        ...paramsRef.current,
        page: current.current + 1,
        perPage: SEARCH_PER_PAGE,
      });
      if (requestId === requestIdRef.current) {
        setState((prev) => {
          if (prev == null || prev.key !== fullKey) return prev;
          const seen = new Set(prev.items.map((r) => r.id));
          return {
            ...prev,
            items: [
              ...prev.items,
              ...result.recipes.filter((r) => !seen.has(r.id)),
            ],
            current: result.currentPage,
            last: result.lastPage,
            total: result.total,
          };
        });
      }
    } catch (error) {
      // Keep the loaded pages; surface briefly. 429 gets the friendly copy.
      if (isRateLimitedError(error)) {
        toast.error(t("common.rateLimited"));
      } else {
        toast.error(t("common.error"));
      }
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  if (current == null) {
    return <GridSkeleton />;
  }

  if (current.phase === "error") {
    return (
      <EmptyState
        title={t("common.error")}
        body={t("common.offline")}
        action={
          <Button onClick={() => setRetryNonce((n) => n + 1)}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  if (current.items.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div>
      {current.total > 0 ? (
        <p className="mb-3 font-body text-[13px] font-semibold text-faint">
          {t("browse.countOf", { shown: current.items.length, total: current.total })}
        </p>
      ) : null}
      <div className={GRID_COLS}>
        {current.items.map((recipe) => (
          <BrowseRecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>
      {current.current < current.last ? (
        <div className="mt-8 flex justify-center">
          <Button
            variant="ghost"
            loading={loadingMore}
            disabled={loadingMore}
            onClick={() => {
              void handleLoadMore();
            }}
          >
            {loadingMore ? t("browse.loadingMore") : t("browse.loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
