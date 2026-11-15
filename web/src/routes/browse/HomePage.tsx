/**
 * Home rails (route /) — OWNED BY SLICE BROWSE.
 *
 * Web twin of mobile's home screen: a kitchen-table hero header (greeting +
 * tagline + search entry), the featured "really takes" hero (deterministic
 * daily pick from the reality rail, top-rated fallback), then the curated
 * rails from GET /api/home with the "most underestimated" rail merged in
 * from GET /api/reality, and the "browse by craving" category chips.
 * Rails mirror the last successful payload to localStorage for instant
 * paint on return (stale-while-revalidate); the fresh payload replaces it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";

import { isRateLimitedError } from "@/api/http";
import {
  fetchHomeRails,
  readMirroredHomeRails,
  writeMirroredHomeRails,
} from "@/api/home";
import { bestMinutes, fetchCategories, localizedTitle } from "@/api/recipes";
import { fetchRealityRail } from "@/api/reality";
import type { CategoryCount, HomeRails, Recipe } from "@/api/types";
import { BrowseCategoryChip } from "@/components/BrowseCategoryChip";
import { BrowseRail, BrowseRailSkeleton } from "@/components/BrowseRail";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { TimeBadge } from "@/components/TimeBadge";
import { useToast } from "@/components/Toast";
import { useFavorites } from "@/state/favorites";
import { useLang, useT } from "@/i18n";
import { cn } from "@/utils/cn";

/** Craving chips rendered in the "Browse by craving" rail (mobile parity). */
const CRAVING_CHIP_LIMIT = 12;

/** Photo-first home: rails/featured only ever show recipes with an image. */
const hasPhoto = (r: Recipe): boolean =>
  typeof r.image_url === "string" && r.image_url.trim().length > 0;

/** 1-based day of the year — drives the deterministic daily featured pick. */
function dayOfYear(d = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

/** Greeting key by hour (mobile copy). */
function greetingKey(): string {
  const h = new Date().getHours();
  return h < 12
    ? "home.greetMorning"
    : h < 17
      ? "home.greetAfternoon"
      : "home.greetEvening";
}

/** Featured hero: the daily pick with the honest-time treatment. */
function FeaturedHero({ recipe }: { recipe: Recipe }) {
  const t = useT();
  const { lang } = useLang();
  const { isFavorite, toggle } = useFavorites();
  const title = localizedTitle(recipe, lang);
  const favorited = isFavorite(recipe.id);
  const reality = recipe.reality;
  const rating =
    recipe.aggregated_rating != null && recipe.aggregated_rating > 0
      ? recipe.aggregated_rating.toFixed(1)
      : null;

  return (
    <Card className="relative mt-6 overflow-hidden">
      <div className="grid md:grid-cols-[1.05fr_1fr]">
        <div className="relative min-h-56 md:min-h-80">
          {recipe.image_url != null ? (
            <img
              src={recipe.image_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-cream-deep" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => {
              toggle(recipe.id);
            }}
            aria-pressed={favorited}
            aria-label={
              favorited ? t("browse.favoriteRemove") : t("browse.favoriteAdd")
            }
            className={cn(
              "absolute end-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-pill border transition-colors",
              favorited
                ? "border-orange/30 bg-white text-orange"
                : "border-hair bg-white/90 text-muted hover:text-orange",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5"
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
        <div className="flex flex-col gap-3 p-5 md:justify-center md:gap-4 md:p-8">
          <p className="font-body text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-orange-deep">
            {t("home.featuredLabel")}
          </p>
          <h2 className="font-display text-[clamp(1.4rem,2.6vw,2rem)] font-semibold leading-tight text-ink">
            {title}
          </h2>
          <TimeBadge
            claimedMinutes={recipe.publisher_time_minutes}
            reallyMinutes={bestMinutes(recipe)}
            size="md"
          />
          {reality != null ? (
            <p className="font-body text-[13px] text-faint">
              {reality.source === "community"
                ? t("home.realityFrom", { n: reality.samples })
                : t("home.realityEstimate")}
              {rating != null ? ` · ★ ${rating}` : ""}
            </p>
          ) : null}
          <Link
            to={`/recipe/${recipe.id}`}
            className="mt-2 inline-flex w-fit items-center justify-center rounded-pill bg-orange px-7 py-3.5 font-body text-[15.5px] font-bold tracking-tight text-white shadow-[var(--shadow-btn)] transition-colors hover:bg-orange-deep"
          >
            {t("home.startCooking")}
          </Link>
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const t = useT();
  const toast = useToast();

  // Instant paint from the mirror when present; the fresh fetch revalidates.
  // (Initializers run in declaration order, so `mirror` is settled below.)
  const [mirror] = useState(() => readMirroredHomeRails());
  // Successful fresh load, stamped with the retry nonce that produced it
  // (keyed-state pattern: no synchronous setState in the fetch effect).
  const [fresh, setFresh] = useState<{ nonce: number; rails: HomeRails } | null>(
    null,
  );
  const [failedNonce, setFailedNonce] = useState<number | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [categories, setCategories] = useState<CategoryCount[]>([]);

  // Latest translator, synced after render (react-hooks/refs contract) — the
  // fetch effect reads t through it so a language switch never restarts it.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  useEffect(() => {
    let active = true;
    Promise.all([fetchHomeRails(), fetchRealityRail("under")])
      .then(([fetched, mostUnderestimated]) => {
        if (!active) return;
        const merged: HomeRails = {
          ...fetched,
          most_underestimated: mostUnderestimated,
        };
        setFresh({ nonce: retryNonce, rails: merged });
        writeMirroredHomeRails(merged);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isRateLimitedError(error)) {
          toast.error(tRef.current("common.rateLimited"));
        }
        // Keep any mirrored payload; only a cold failure surfaces.
        setFailedNonce(retryNonce);
      });
    return () => {
      active = false;
    };
  }, [retryNonce, toast]);

  // Derived load state: fresh result wins, the mirror paints meanwhile, and
  // a cold failure (nothing fetched, nothing mirrored) shows the error card.
  const freshRails = fresh?.nonce === retryNonce ? fresh.rails : null;
  const rails = freshRails ?? mirror;
  const coldFailed = failedNonce === retryNonce && rails == null;
  const loading = rails == null && !coldFailed;

  // Craving chips (server categories; hidden when the list is empty — the
  // mobile offline fallback list is a no-op online-first on the web).
  useEffect(() => {
    let active = true;
    fetchCategories()
      .then((rows) => {
        if (active) setCategories(rows);
      })
      .catch(() => {
        // Chips are a nice-to-have; failures fall back to hidden.
      });
    return () => {
      active = false;
    };
  }, []);

  // Featured recipe of the day: deterministic pick from the reality
  // "most underestimated" rail, falling back to "Top rated" (mobile parity).
  const featured = useMemo(() => {
    if (rails == null) return null;
    const pool = (
      rails.most_underestimated.length > 0
        ? rails.most_underestimated
        : rails.top_rated
    ).filter(hasPhoto);
    if (pool.length === 0) return null;
    return pool[dayOfYear() % pool.length];
  }, [rails]);

  const cravingChips = categories.slice(0, CRAVING_CHIP_LIMIT);
  const railsAllEmpty =
    rails != null &&
    rails.top_rated.length === 0 &&
    rails.easy_wins.length === 0 &&
    rails.most_loved.length === 0 &&
    rails.hands_off.length === 0 &&
    rails.most_underestimated.length === 0;

  return (
    <div>
      {/* ---- Kitchen-table hero header ---------------------------------- */}
      <section>
        <p className="font-body text-[13px] font-bold uppercase tracking-[0.14em] text-orange-deep">
          {t(greetingKey())}
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-[clamp(1.9rem,4.5vw,3rem)] font-semibold leading-[1.15] text-ink">
          {t("home.tagline")}
        </h1>
        <Link
          to="/browse?focus=1"
          className="mt-6 flex w-full max-w-xl items-center gap-3 rounded-pill border border-hair bg-white px-5 py-3.5 font-body text-[14.5px] text-faint transition-colors hover:border-orange"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-5 w-5 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.8-3.8" />
          </svg>
          {t("home.heroPrompt")}
        </Link>
      </section>

      {/* ---- Loading (cold start, no mirror) ----------------------------- */}
      {loading ? (
        <div>
          <Card className="mt-6 overflow-hidden" aria-hidden="true">
            <div className="grid md:grid-cols-[1.05fr_1fr]">
              <Skeleton className="min-h-56 w-full rounded-none md:min-h-80" />
              <div className="space-y-3 p-5 md:p-8">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-4/5" />
                <Skeleton className="h-8 w-36" />
                <Skeleton className="h-12 w-44" />
              </div>
            </div>
          </Card>
          <BrowseRailSkeleton title={t("home.quickTonight")} />
          <BrowseRailSkeleton title={t("home.railTopRated")} />
        </div>
      ) : null}

      {/* ---- Cold failure (nothing to show) ------------------------------ */}
      {coldFailed ? (
        <EmptyState
          className="mt-8"
          title={t("common.error")}
          body={t("common.offline")}
          action={
            <Button onClick={() => setRetryNonce((n) => n + 1)}>
              {t("common.retry")}
            </Button>
          }
        />
      ) : null}

      {/* ---- Content ------------------------------------------------------ */}
      {rails != null ? (
        <>
          {featured != null ? <FeaturedHero recipe={featured} /> : null}

          {railsAllEmpty ? (
            <EmptyState
              className="mt-8"
              title={t("home.emptyTitle")}
              body={t("home.emptyBody")}
            />
          ) : null}

          <BrowseRail
            title={t("home.quickTonight")}
            items={rails.easy_wins}
          />
          <BrowseRail
            title={t("home.railTopRated")}
            items={rails.top_rated}
          />
          <BrowseRail
            title={t("home.railMostLoved")}
            items={rails.most_loved}
          />
          <BrowseRail
            title={t("home.handsOffHeroes")}
            subtitle={t("home.handsOffSubtitle")}
            items={rails.hands_off}
          />
          <BrowseRail
            title={t("home.realityRail")}
            subtitle={t("home.realityRailSub")}
            items={rails.most_underestimated}
          />

          {cravingChips.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-4 px-1 font-display text-[clamp(1.3rem,2.4vw,1.7rem)] font-semibold leading-tight text-ink">
                {t("home.browseByCraving")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {cravingChips.map((chip) => (
                  <Link
                    key={chip.category}
                    to={`/browse?filter=${encodeURIComponent(chip.category)}`}
                    className="rounded-pill transition-transform hover:-translate-y-0.5"
                  >
                    <BrowseCategoryChip
                      label={chip.category}
                      count={chip.count}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
