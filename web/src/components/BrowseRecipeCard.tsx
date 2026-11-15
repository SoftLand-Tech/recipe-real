/**
 * BrowseRecipeCard — the recipe card used by every BROWSE surface (home
 * rails, browse/search/fridge grids, reality leaderboard contexts).
 * OWNED BY SLICE BROWSE.
 *
 * Per the brief: image (lazy), localized title (API fields title/title_ar),
 * the TimeBadge pair (claimed orange vs measured teal), rating when present,
 * a device-local favorite heart (state/favorites consumed read-only), and a
 * whole-card link to /recipe/:id. Teal appears ONLY for measured-time
 * information (TimeBadge's pill + the measured-derived reality-gap chip),
 * exactly like mobile's "timing" tone.
 */
import { useState } from "react";
import { Link } from "react-router";

import { bestMinutes, localizedTitle } from "@/api/recipes";
import type { Recipe } from "@/api/types";
import { Card } from "@/components/Card";
import { TimeBadge } from "@/components/TimeBadge";
import { useFavorites } from "@/state/favorites";
import { useLang, useT } from "@/i18n";
import { cn } from "@/utils/cn";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20C6 15.5 3 12.6 3 9.2 3 6.9 4.8 5 7.2 5c1.8 0 3.3 1 4.8 3 1.5-2 3-3 4.8-3C19.2 5 21 6.9 21 9.2c0 3.4-3 6.3-9 10.8Z" />
    </svg>
  );
}

/** Designed placeholder when the row has no (or a broken) image. */
function NoImageBody({ title }: { title: string }) {
  return (
    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-cream-deep px-4 py-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-orange-soft text-orange">
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 3v8" />
          <path d="M5 5h4" />
          <path d="M17 3c-1.7.6-2.7 2.4-2.7 4.5S15.3 11 17 11s2.7-1.4 2.7-3.5S18.7 3.6 17 3Z" />
          <path d="M14.3 11c-.6 1.6-2 2.6-3.7 2.8L16 21h2.5" />
          <path d="M7 11.5V21" />
        </svg>
      </span>
      <p className="line-clamp-3 font-body text-[14px] font-bold leading-snug text-ink">
        {title}
      </p>
    </div>
  );
}

export function BrowseRecipeCard({
  recipe,
  className,
}: {
  recipe: Recipe;
  className?: string;
}) {
  const t = useT();
  const { lang } = useLang();
  const { isFavorite, toggle } = useFavorites();
  const [imgFailed, setImgFailed] = useState(false);

  const title = localizedTitle(recipe, lang);
  const reallyMinutes = bestMinutes(recipe);
  const rating =
    recipe.aggregated_rating != null && recipe.aggregated_rating > 0
      ? recipe.aggregated_rating.toFixed(1)
      : null;
  const favorited = isFavorite(recipe.id);
  // Reality gap: measured-vs-claim percent; render only when computed.
  const gap = recipe.reality?.gap_pct;
  const gapLabel =
    gap == null || Math.round(gap) === 0
      ? null
      : `${gap > 0 ? "+" : ""}${Math.round(gap)}%`;

  const imageUrl =
    !imgFailed &&
    typeof recipe.image_url === "string" &&
    recipe.image_url.trim() !== ""
      ? recipe.image_url
      : null;

  return (
    <Card interactive className={cn("group relative overflow-hidden", className)}>
      {/* Whole-card link: the stretched pseudo-element covers the card, so
          the overlaying heart/gap chips stay independently clickable. */}
      <Link
        to={`/recipe/${recipe.id}`}
        aria-label={title}
        className="block after:absolute after:inset-0 after:rounded-card after:content-['']"
      >
        {imageUrl != null ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <NoImageBody title={title} />
        )}
        <div className="space-y-2 p-3">
          <h3 className="line-clamp-2 min-h-[2.6em] font-body text-[14.5px] font-bold leading-snug text-ink">
            {title}
          </h3>
          <TimeBadge
            claimedMinutes={recipe.publisher_time_minutes}
            reallyMinutes={reallyMinutes}
            size="sm"
          />
          {rating != null ? (
            <p
              className="font-body text-[12.5px] font-bold text-muted"
              aria-label={t("browse.ratingAria", { rating })}
            >
              ★ {rating}
            </p>
          ) : null}
        </div>
      </Link>

      {/* Favorite heart — device-local (state/favorites), top-end corner. */}
      <button
        type="button"
        onClick={() => {
          toggle(recipe.id);
        }}
        aria-pressed={favorited}
        aria-label={favorited ? t("browse.favoriteRemove") : t("browse.favoriteAdd")}
        className={cn(
          "absolute end-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-pill border transition-colors",
          favorited
            ? "border-orange/30 bg-white text-orange"
            : "border-hair bg-white/90 text-muted hover:text-orange",
        )}
      >
        <HeartIcon filled={favorited} />
      </button>

      {/* Measured reality gap (teal: measured-time information only). */}
      {gapLabel != null ? (
        <span
          className="absolute start-2.5 top-2.5 z-10 rounded-pill bg-teal/10 px-2.5 py-1 font-body text-[12px] font-bold text-teal"
          aria-hidden="true"
        >
          {gapLabel}
        </span>
      ) : null}
    </Card>
  );
}
