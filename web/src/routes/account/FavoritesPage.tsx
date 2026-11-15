/**
 * Favorites (/favorites, PUBLIC — device-local by design) — OWNED BY SLICE
 * ACCOUNT.
 *
 * The web twin of mobile's favorites tab, minus the offline library: the
 * id list lives in the FOUNDATION store (localStorage 'rr_favorites_v1',
 * imported read-only here) and this page hydrates each id through
 * GET /api/recipes/{id} in small polite batches (concurrency 4). 404s prune
 * the id (the recipe is gone forever); a 429 stops the batch with the
 * friendly rate-limit toast per the API contract — never a crash. Works
 * signed-out because there is NO backend favorites endpoint; the copy says
 * so honestly.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { fetchRecipeById } from "@/api/account";
import { isRateLimitedError } from "@/api/http";
import { AccountRecipeCard } from "@/components/AccountRecipeCard";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useT } from "@/i18n";
import { useFavorites } from "@/state/favorites";

import type { Recipe } from "@/api/types";

/** Concurrent recipe fetches per batch — polite to the shared backend. */
const BATCH_SIZE = 4;

function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { status?: unknown } }).response;
    if (response && typeof response.status === "number") return response.status;
  }
  return undefined;
}

export default function FavoritesPage() {
  const t = useT();
  const toast = useToast();
  const { ids, toggle } = useFavorites();

  const [recipes, setRecipes] = useState<Record<number, Recipe>>({});
  const [failedIds, setFailedIds] = useState<number[]>([]);
  const [retryTick, setRetryTick] = useState(0);
  const runIdRef = useRef(0);
  // Snapshots for the hydration effect (declared before it, synced first):
  // the effect runs on idsKey/retryTick only and reads these instead of
  // re-triggering on every batch it commits.
  const recipesRef = useRef(recipes);
  const failedRef = useRef(failedIds);
  useEffect(() => {
    recipesRef.current = recipes;
  }, [recipes]);
  useEffect(() => {
    failedRef.current = failedIds;
  }, [failedIds]);

  const numericIds = useMemo(
    () =>
      ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0),
    [ids],
  );
  // Stable key so the hydration effect only re-runs when the LIST changes.
  const idsKey = numericIds.join(",");

  useEffect(() => {
    const run = ++runIdRef.current;
    const missing = numericIds.filter(
      (id) => recipesRef.current[id] == null && !failedRef.current.includes(id),
    );
    if (missing.length === 0) return;

    void (async () => {
      for (let start = 0; start < missing.length; start += BATCH_SIZE) {
        const batch = missing.slice(start, start + BATCH_SIZE);
        // First statement is an await: every setState below lands in an
        // async continuation, never synchronously inside this effect.
        const settled = await Promise.allSettled(
          batch.map((id) => fetchRecipeById(id)),
        );
        if (runIdRef.current !== run) return;

        const loaded: Record<number, Recipe> = {};
        const failed: number[] = [];
        let rateLimited = false;
        settled.forEach((outcome, index) => {
          const id = batch[index];
          if (outcome.status === "fulfilled") {
            loaded[id] = outcome.value;
          } else if (statusOf(outcome.reason) === 404) {
            // The recipe is gone server-side — prune the stale favorite so
            // the list stays honest (through the store's own toggle path).
            toggle(id);
          } else if (isRateLimitedError(outcome.reason)) {
            rateLimited = true;
            failed.push(id);
          } else {
            failed.push(id);
          }
        });

        if (Object.keys(loaded).length > 0) {
          setRecipes((prev) => ({ ...prev, ...loaded }));
        }
        if (rateLimited) {
          toast.error(t("common.rateLimited"));
          setFailedIds((prev) => Array.from(new Set([...prev, ...failed])));
          return;
        }
        if (failed.length > 0) {
          setFailedIds((prev) => Array.from(new Set([...prev, ...failed])));
        }
      }
    })();
    // numericIds is derived from ids; idsKey is its stable serialization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, retryTick, t, toast, toggle]);

  const onRemove = useCallback(
    (recipeId: number) => {
      toggle(recipeId);
    },
    [toggle],
  );

  // Rendered rows keep the store's order (newest favorite first); ids that
  // failed hydration are covered by the retry banner instead of skeletons.
  const failedSet = useMemo(() => new Set(failedIds), [failedIds]);
  const cards = numericIds
    .filter((id) => !failedSet.has(id))
    .map((id) => ({ id, recipe: recipes[id] ?? null }));
  const pendingHydration = cards.some(({ recipe }) => recipe == null);

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-semibold leading-tight text-ink">
            {t("favorites.pageTitle")}
          </h1>
          <p className="mt-1 font-body text-[14.5px] text-muted">
            {t("favorites.subtitle")}
          </p>
        </div>
        {numericIds.length > 0 ? (
          <span className="rounded-pill bg-cream-deep px-3.5 py-1.5 font-body text-[12.5px] font-bold text-muted tabular-nums">
            {t("favorites.count", { n: numericIds.length })}
          </span>
        ) : null}
      </div>

      {numericIds.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={t("favorites.emptyTitle")}
            body={t("favorites.emptyCaption")}
            action={
              <Link
                to="/browse"
                className="inline-flex items-center justify-center rounded-pill bg-orange px-7 py-3.5 font-body text-[15.5px] font-bold text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-orange-deep"
              >
                {t("favorites.browseRecipes")}
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <p className="mt-2 font-body text-[12.5px] text-faint">
            {t("favorites.deviceLocal")}
          </p>

          <div
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-busy={pendingHydration || undefined}
          >
            {cards.map(({ id, recipe }) =>
              recipe ? (
                <AccountRecipeCard
                  key={id}
                  recipe={recipe}
                  favorited
                  onToggleFavorite={onRemove}
                />
              ) : (
                <Card key={id} className="overflow-hidden" aria-hidden="true">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="space-y-2.5 px-4 pb-5 pt-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </Card>
              ),
            )}
          </div>

          {failedIds.length > 0 ? (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <span className="font-body text-[13.5px] text-muted">
                {t("favorites.someFailed", { n: failedIds.length })}
              </span>
              <button
                type="button"
                onClick={() => {
                  setFailedIds([]);
                  setRetryTick((tick) => tick + 1);
                }}
                className="rounded-pill px-3 py-1.5 font-body text-[13.5px] font-bold text-orange-deep transition-colors hover:bg-orange-soft"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
