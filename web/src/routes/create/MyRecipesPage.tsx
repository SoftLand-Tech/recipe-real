/**
 * My recipes — /create/recipes. OWNED BY SLICE CREATE (auth-gated).
 *
 * GET /api/users/me/recipes (12/page, newest first): the account's own
 * recipe rows with edit/delete actions (DELETE /api/recipes/:id behind a
 * confirm dialog). Empty state funnels straight into the composer.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";

import { isRateLimitedError } from "@/api/http";
import { deleteUserRecipe, fetchMyRecipes } from "@/api/userRecipes";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { TimeBadge } from "@/components/TimeBadge";
import { useToast } from "@/components/Toast";
import { CreateConfirmDialog } from "@/components/CreateConfirmDialog";
import { useT } from "@/i18n";

import type { Recipe } from "@/api/types";

export default function MyRecipesPage() {
  const t = useT();
  const toast = useToast();

  const [rows, setRows] = useState<Recipe[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKind, setErrorKind] = useState<"network" | "rate" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stable identity (error kind, not translated message, so the list doesn't
  // refetch when the language flips).
  const load = useCallback(async (targetPage: number) => {
    const isFirst = targetPage === 1;
    if (isFirst) setRows(null);
    setErrorKind(null);
    try {
      const res = await fetchMyRecipes(targetPage);
      setRows((prev) => isFirst ? res.data : [...(prev ?? []), ...res.data]);
      setHasMore(res.meta.current_page < res.meta.last_page);
      setPage(res.meta.current_page);
    } catch (err) {
      setErrorKind(isRateLimitedError(err) ? "rate" : "network");
      if (isFirst) setRows([]);
    }
  }, []);

  useEffect(() => {
    // Deferred one microtask: load() setStates synchronously before its
    // first await, which the hooks lint forbids directly in an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void load(1);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await load(page + 1);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, load, page]);

  const confirmDelete = useCallback(async () => {
    if (deleteTarget == null) return;
    setDeleting(true);
    try {
      await deleteUserRecipe(deleteTarget.id);
      setRows((prev) =>
        prev ? prev.filter((row) => row.id !== deleteTarget.id) : prev,
      );
      setDeleteTarget(null);
      toast.show(t("myRecipes.deletedToast"));
    } catch (err) {
      toast.error(
        isRateLimitedError(err)
          ? t("common.rateLimited")
          : t("myRecipes.deleteFailed"),
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, toast, t]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 self-start rounded-pill px-3 py-1.5 font-body text-[14px] font-semibold text-muted transition-colors hover:text-ink"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-4 w-4 rtl:-scale-x-100"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 6l-6 6 6 6" />
            </svg>
            {t("common.back")}
          </Link>
          <h1 className="font-display text-[clamp(1.6rem,3.5vw,2.1rem)] font-semibold leading-tight text-ink">
            {t("myRecipes.pageTitle")}
          </h1>
          <p className="font-body text-[14.5px] leading-relaxed text-muted">
            {t("myRecipes.subtitle")}
          </p>
        </div>
        <Link
          to="/create/recipe"
          className="rounded-pill bg-orange px-6 py-2.5 font-body text-[14px] font-bold text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-orange-deep"
        >
          {t("myRecipes.newCta")}
        </Link>
      </header>

      {errorKind != null && rows == null ? (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="font-body text-[15px] font-semibold text-ink">
            {errorKind === "rate"
              ? t("common.rateLimited")
              : t("myRecipes.loadFailed")}
          </p>
          <Button
            variant="ghost"
            className="px-5 py-2.5 text-[14px]"
            onClick={() => void load(1)}
          >
            {t("common.retry")}
          </Button>
        </Card>
      ) : rows == null ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-24 w-full rounded-card" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("myRecipes.emptyTitle")}
          body={t("myRecipes.emptyBody")}
          action={
            <Link
              to="/create/recipe"
              className="rounded-pill bg-orange px-7 py-3 font-body text-[14.5px] font-bold text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-orange-deep"
            >
              {t("myRecipes.emptyCta")}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((recipe) => (
              <li key={recipe.id}>
                <Card className="flex items-center gap-4 p-4">
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 shrink-0 rounded-md border border-hair object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-hair bg-cream-deep">
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-6 w-6 text-faint"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
                        <path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8" />
                      </svg>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2
                      dir="auto"
                      className="truncate font-body text-[15.5px] font-bold text-ink"
                    >
                      {recipe.title}
                    </h2>
                    <div className="mt-1.5">
                      <TimeBadge
                        size="sm"
                        claimedMinutes={recipe.publisher_time_minutes}
                        reallyMinutes={recipe.reality?.minutes ?? null}
                      />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      to={`/create/recipe/${recipe.id}`}
                      className="rounded-pill border border-[#E8DFD2] bg-white px-4 py-2 font-body text-[13px] font-bold text-ink transition-colors hover:border-orange hover:text-orange-deep"
                    >
                      {t("common.edit")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(recipe)}
                      aria-label={t("myRecipes.deleteA11y", {
                        title: recipe.title,
                      })}
                      className="flex h-9 w-9 items-center justify-center rounded-pill border border-[#E8DFD2] bg-white text-muted transition-colors hover:border-orange hover:text-orange-deep"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h16M9.5 7V5h5v2M6.5 7l.8 12a1.8 1.8 0 0 0 1.8 1.7h5.8a1.8 1.8 0 0 0 1.8-1.7l.8-12" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <Button
              variant="ghost"
              className="self-center px-8 py-3"
              loading={loadingMore}
              onClick={() => void loadMore()}
            >
              {t("myRecipes.loadMore")}
            </Button>
          ) : null}
        </>
      )}

      <CreateConfirmDialog
        open={deleteTarget != null}
        title={t("myRecipes.deleteConfirmTitle")}
        body={t("myRecipes.deleteConfirmMessage")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
