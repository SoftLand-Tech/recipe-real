/**
 * Recipe detail (route /recipe/:id) — OWNED BY SLICE RECIPE.
 *
 * Web port of mobile/src/app/recipe/[id].tsx's feature set per the slice
 * brief: hero + rating, the signature claimed-vs-really TimeBadge pair
 * (teal = measured only) with the reality chip, servings scaler with the
 * exact mobile ingredient-scaling math, checkable ingredients, numbered
 * steps with per-step estimates (pace-adjusted when calibrations exist),
 * quick-time contribution, community notes, favorites (device-local store),
 * and the Start Cook Mode CTA.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { fetchPaceCalibrations, fetchRecipe } from "@/api/cook";
import { isOfflineError, isRateLimitedError } from "@/api/http";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { TimeBadge } from "@/components/TimeBadge";
import { useToast } from "@/components/Toast";
import { useFavorites } from "@/state/favorites";
import { useFmtMinutes, useT } from "@/i18n";
import type { PaceCalibration, Recipe, RecipeStep } from "@/api/types";
import {
  estimateStepMinutes,
  roundMin,
  stepMinutes,
} from "@/routes/recipe/RecipeTimeMath";
import { RecipeIngredientsCard } from "@/routes/recipe/RecipeIngredientsCard";
import { RecipeNotesSection } from "@/routes/recipe/RecipeNotesSection";
import { RecipeQuickTimeCard } from "@/routes/recipe/RecipeQuickTimeCard";
import { greaseLevelLabel, useLocalizedRecipe } from "@/routes/recipe/RecipeLocalizedText";
import { cn } from "@/utils/cn";

type LoadState = "loading" | "ready" | "error";

/** Publisher hostname ("food.com") for the hero's tiny attribution line. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The reality badge label for the ±20% gap thresholds (always teal-toned). */
function realityChipLabel(
  t: ReturnType<typeof useT>,
  gapPct: number,
): string {
  if (gapPct >= 20) {
    return t("recipe.realitySlower", { pct: Math.round(gapPct) });
  }
  if (gapPct <= -20) {
    return t("recipe.realityFaster", { pct: Math.round(Math.abs(gapPct)) });
  }
  return t("recipe.realityAccurate");
}

/** Cleanup-burden chip labels; each entry only when its value is non-null. */
function cleanupChips(t: ReturnType<typeof useT>, recipe: Recipe): string[] {
  const factors = recipe.cleanup_factors;
  if (!factors) return [];
  const chips: string[] = [];
  if (factors.dish_count != null) {
    chips.push(t("recipe.dishes", { n: Math.round(factors.dish_count) }));
  }
  if (factors.grease_level) {
    chips.push(greaseLevelLabel(t, factors.grease_level));
  }
  if (factors.dishwasher_safe != null) {
    chips.push(
      factors.dishwasher_safe
        ? t("recipe.dishwasherSafe")
        : t("recipe.handWash"),
    );
  }
  return chips;
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const validId = Number.isFinite(numericId) && numericId > 0;

  const t = useT();
  const fmtMin = useFmtMinutes();
  const navigate = useNavigate();
  const lr = useLocalizedRecipe();
  const toast = useToast();
  const { status: authStatus, user } = useAuth();
  const authed = authStatus === "authed";
  const myUserId = user?.id ?? null;
  const favorites = useFavorites();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  /** Error KIND (translated at render, so a language switch never refetches). */
  const [errorKind, setErrorKind] = useState<
    "offline" | "rateLimited" | "generic" | null
  >(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  /** Bumped each time the "Be the first!" stat asks the quick-time card to open. */
  const [quickOpenSignal, setQuickOpenSignal] = useState(0);
  /** Server-recomputed average right after a quick-time submit on this page. */
  const [quickSubmittedAvg, setQuickSubmittedAvg] = useState<
    number | null | undefined
  >(undefined);

  const loadRequestIdRef = useRef(0);
  const loadRecipe = useCallback(async () => {
    if (!validId) {
      setErrorKind("generic");
      setState("error");
      return;
    }
    const requestId = ++loadRequestIdRef.current;
    setErrorKind(null);
    setState("loading");
    try {
      const fetched = await fetchRecipe(id!);
      if (requestId !== loadRequestIdRef.current) return;
      setRecipe(fetched);
      setState("ready");
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      if (isOfflineError(error)) setErrorKind("offline");
      else if (isRateLimitedError(error)) setErrorKind("rateLimited");
      else setErrorKind("generic");
      setState("error");
    }
  }, [id, validId]);

  useEffect(() => {
    // Deferred one microtask: the loader setStates synchronously before its
    // first await, which the hooks lint forbids directly in an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadRecipe();
    });
    return () => {
      cancelled = true;
    };
  }, [loadRecipe]);

  // Pace calibrations: signed-in cooks get their multipliers (a 401 inside
  // the helper degrades to []); anonymous visitors simply see publisher and
  // community estimates. The anon case is DERIVED (not a sync setState in
  // the effect): fetched values are simply ignored when signed out.
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    fetchPaceCalibrations()
      .then((items) => {
        if (!cancelled) setCalibrations(items);
      })
      .catch(() => {
        // Pace is an enhancement; a failure must not disturb the page.
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);
  const effectiveCalibrations = useMemo(
    () => (authed ? calibrations : []),
    [authed, calibrations],
  );

  const steps: RecipeStep[] = useMemo(
    () => recipe?.recipe_steps ?? [],
    [recipe],
  );

  // Everything derived from the calibrations: the step_type → multiplier map,
  // the personalized adjusted time per step and the personalized total.
  const { personalTotal, adjustedForStep } = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of effectiveCalibrations) map.set(c.step_type, c.multiplier);

    const adjustFor = (step: RecipeStep): number | null => {
      if (step.community_minutes == null) return null;
      const mult = map.get(step.step_type);
      if (mult == null || mult === 1) return null;
      return Math.round(step.community_minutes * mult);
    };

    let personalizedTotal: number | null = null;
    if (effectiveCalibrations.length > 0 && recipe) {
      let sum = 0;
      let hasAny = false;
      for (const step of steps) {
        if (step.step_type === "cleanup") continue;
        const stepM = stepMinutes(step);
        if (stepM == null) continue;
        sum += stepM * (map.get(step.step_type) ?? 1);
        hasAny = true;
      }
      if (recipe.cleanup_avg_minutes != null) {
        sum += recipe.cleanup_avg_minutes * (map.get("cleanup") ?? 1);
        hasAny = true;
      }
      if (hasAny) personalizedTotal = Math.round(sum);
    }
    return { personalTotal: personalizedTotal, adjustedForStep: adjustFor };
  }, [effectiveCalibrations, recipe, steps]);

  const publisher = roundMin(recipe?.publisher_time_minutes);
  const community = roundMin(recipe?.community_avg_minutes);
  const reality = recipe?.reality ?? null;
  const reallyTakes =
    reality != null && reality.minutes > 0
      ? roundMin(reality.minutes)
      : (community ??
        (quickSubmittedAvg !== undefined ? roundMin(quickSubmittedAvg) : null));
  const cleanupEstimate = roundMin(
    recipe?.cleanup_estimate_minutes ?? recipe?.cleanup_avg_minutes ?? null,
  );

  const sourceHost = recipe?.source_url ? hostOf(recipe.source_url) : null;
  const ratingText =
    recipe?.aggregated_rating != null
      ? recipe.review_count != null && recipe.review_count > 0
        ? t("recipe.ratingWithCount", {
            rating: recipe.aggregated_rating.toFixed(1),
            n: recipe.review_count,
          })
        : t("recipe.ratingOnly", {
            rating: recipe.aggregated_rating.toFixed(1),
          })
      : null;

  const favorited = validId ? favorites.isFavorite(numericId) : false;
  const onToggleFavorite = useCallback(() => {
    if (!validId) return;
    favorites.toggle(numericId);
  }, [favorites, numericId, validId]);

  const onShare = useCallback(async () => {
    if (!recipe) return;
    const url = `${window.location.origin}/r/${recipe.id}`;
    const title = lr.title(recipe);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.show(t("recipe.shareCopied"));
      }
    } catch {
      // The user dismissed the sheet (or the platform errored) — best-effort.
    }
  }, [recipe, lr, toast, t]);

  const title = recipe ? lr.title(recipe) : "";
  const chips = recipe ? cleanupChips(t, recipe) : [];
  const isOwner =
    recipe?.source_type === "user" &&
    myUserId != null &&
    recipe.owner_id === myUserId;

  const openQuick = useCallback(() => {
    setQuickOpenSignal((n) => n + 1);
    // Scroll the card into view so the expansion is visible.
    requestAnimationFrame(() => {
      document
        .getElementById("quick-time-card")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);

  const cookHref = validId ? `/cook/${numericId}` : "#";

  // ---- Render: loading skeleton ----
  if (state === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        <Skeleton className="h-64 w-full rounded-card md:h-80" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  // ---- Render: error (bad id / 404 / offline) ----
  if (state === "error" || !recipe) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">
          {t("common.error")}
        </h1>
        <p className="max-w-md text-[15px] leading-relaxed text-muted">
          {errorKind === "offline"
            ? t("common.offline")
            : errorKind === "rateLimited"
              ? t("common.rateLimited")
              : t("recipe.loadFailed")}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => void loadRecipe()}>{t("common.retry")}</Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            {t("common.goHome")}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Render: ready ----
  return (
    <article className="flex flex-col gap-6">
      {/* HERO — rounded photo card with scrim; title + rating live over it. */}
      <div className="relative overflow-hidden rounded-card border border-hair bg-cream-deep shadow-[var(--shadow-card)]">
        {recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt=""
            className="h-64 w-full object-cover md:h-80"
            loading="eager"
          />
        ) : (
          <div className="h-40 w-full bg-gradient-to-b from-cream-deep to-cream md:h-48" />
        )}
        <div
          className={cn(
            "absolute inset-0",
            recipe.image_url &&
              "bg-gradient-to-t from-black/70 via-black/25 to-black/30",
          )}
          aria-hidden="true"
        />

        {/* Floating actions (logical insets — flip with the direction). */}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("recipe.backA11y")}
            className="flex h-9 w-9 items-center justify-center rounded-pill bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onShare()}
              aria-label={t("recipe.shareA11y")}
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 14V4M8.5 7 12 3.5 15.5 7" />
                <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={
                favorited
                  ? t("recipe.favoriteRemoveA11y")
                  : t("recipe.favoriteAddA11y")
              }
              aria-pressed={favorited}
              className="flex h-9 w-9 items-center justify-center rounded-pill bg-black/40 text-white backdrop-blur transition-colors hover:bg-black/60"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className={cn("h-5 w-5", favorited && "text-[#E8384F]")}
                fill={favorited ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20C6 15.5 3 12.6 3 9.2 3 6.9 4.8 5 7.2 5c1.8 0 3.3 1 4.8 3 1.5-2 3-3 4.8-3C19.2 5 21 6.9 21 9.2c0 3.4-3 6.3-9 10.8Z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 md:p-6">
          <h1
            className={cn(
              "font-display text-[26px] font-bold leading-tight tracking-tight md:text-[32px]",
              recipe.image_url
                ? "text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.55)]"
                : "text-ink",
            )}
          >
            {title}
          </h1>
          {ratingText != null || sourceHost != null ? (
            <p
              className={cn(
                "mt-1 text-[13px] font-bold",
                recipe.image_url
                  ? "text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]"
                  : "text-muted",
              )}
            >
              {[ratingText, sourceHost].filter(Boolean).join("  ·  ")}
            </p>
          ) : null}
        </div>
      </div>

      {/* FACT BOX — the signature pair (claimed vs really takes) + reality
          chip + cleanup context. Teal appears ONLY on measured time. */}
      <Card className="flex flex-col gap-3 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <TimeBadge
            claimedMinutes={publisher}
            reallyMinutes={reallyTakes}
            size="md"
          />
          {reallyTakes == null ? (
            <button
              type="button"
              onClick={openQuick}
              className="inline-flex items-center rounded-pill bg-orange-soft px-3.5 py-1.5 text-[13px] font-bold text-orange-deep transition-colors hover:bg-orange/20"
            >
              {t("recipe.beTheFirst")}
            </button>
          ) : null}
          {reality?.gap_pct != null ? (
            <span className="inline-flex items-center rounded-pill bg-teal/10 px-3 py-1.5 text-[12.5px] font-bold text-teal">
              {realityChipLabel(t, reality.gap_pct)}
            </span>
          ) : null}
        </div>
        {(cleanupEstimate != null || chips.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted">
            {cleanupEstimate != null ? (
              <span className="font-semibold">
                {t("recipe.cleanupAfter", { time: fmtMin(cleanupEstimate) })}
              </span>
            ) : null}
            {chips.map((chip) => (
              <span
                key={chip}
                className="rounded-pill bg-cream-deep px-3 py-1 text-[12px] font-bold text-muted"
              >
                {chip}
              </span>
            ))}
          </div>
        )}
        {personalTotal != null ? (
          <p className="text-[13px] font-bold text-teal">
            {t("pace.yourTotal", { time: fmtMin(personalTotal) })}
          </p>
        ) : null}
        {isOwner ? (
          <Link
            to={`/create/recipe/${recipe.id}`}
            className="self-start font-body text-[13.5px] font-bold text-orange-deep hover:underline"
          >
            {t("recipe.editRecipe")}
          </Link>
        ) : null}
      </Card>

      {/* INGREDIENTS — scaler + checklist. */}
      <RecipeIngredientsCard key={recipe.id} recipe={recipe} />

      {/* STEPS — numbered, with per-step estimates (pace-adjusted). */}
      <Card className="px-6 py-6">
        <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">
          {t("recipe.stepsTitle")}
        </h2>
        {steps.length === 0 ? (
          <p className="mt-3 text-[14.5px] text-muted">{t("cook.noSteps")}</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {steps.map((step) => {
              const estimate = estimateStepMinutes(step, recipe, steps);
              const adjusted = adjustedForStep(step);
              const passive = step.step_type === "passive";
              return (
                <li key={step.id} className="flex items-start gap-3.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-orange-soft text-[13px] font-extrabold text-orange-deep">
                    {step.step_number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-relaxed text-ink">
                      {lr.stepDescription(step)}
                    </p>
                    {passive || adjusted != null ? (
                      <p className="mt-1 text-[12.5px] font-semibold text-muted">
                        {[
                          passive ? t("recipe.handsOff") : null,
                          adjusted != null
                            ? t("recipe.adjustedForYou", {
                                time: fmtMin(adjusted),
                              })
                            : null,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12.5px] font-semibold text-muted">
                        {t("cook.stepExpected", { n: estimate })}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-6">
          <Link to={cookHref}>
            <Button className="w-full py-4 text-[16px]" disabled={steps.length === 0}>
              {t("recipe.startCookMode")}
            </Button>
          </Link>
        </div>
      </Card>

      {/* QUICK-TIME contribution. */}
      <div id="quick-time-card">
        <RecipeQuickTimeCard
          recipeId={recipe.id}
          onSubmitted={setQuickSubmittedAvg}
          openSignal={quickOpenSignal}
        />
      </div>

      {/* COMMUNITY NOTES. */}
      <RecipeNotesSection
        recipeId={recipe.id}
        authed={authed}
        myUserId={myUserId}
      />

      {/* Sticky mobile-web CTA (sits above the bottom tab bar; desktop uses
          the in-flow button inside the steps card). */}
      <div className="fixed inset-x-0 bottom-16 z-30 px-4 pb-2 md:hidden">
        <Link to={cookHref} className="block">
          <Button className="w-full py-3.5 shadow-[var(--shadow-btn)]" disabled={steps.length === 0}>
            {t("recipe.startCookMode")}
          </Button>
        </Link>
      </div>
    </article>
  );
}
