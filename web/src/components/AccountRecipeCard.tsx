/**
 * Recipe card for the ACCOUNT slice's grids (public profile recipes,
 * favorites): cover photo (or spark fallback tile), localized title, the
 * claim-vs-reality TimeBadge, and — on favorites — the un-heart affordance
 * floating over the cover. RTL-safe: logical end-side positioning only, and
 * the heart sits outside the stretched link (a <button> may not nest in an
 * <a>).
 */
import { Link } from "react-router";

import { TimeBadge } from "@/components/TimeBadge";
import { useLang, useT } from "@/i18n";

import type { Recipe } from "@/api/types";

/** Best-known display minutes (mobile's bestMinutes, display variant). */
function bestMinutes(recipe: Recipe): number | null {
  return (
    recipe.reality?.minutes ??
    recipe.community_avg_minutes ??
    recipe.publisher_time_minutes ??
    null
  );
}

export function AccountRecipeCard({
  recipe,
  favorited,
  onToggleFavorite,
}: {
  recipe: Recipe;
  /** When set the card shows the remove-from-favorites heart. */
  favorited?: boolean;
  onToggleFavorite?: (recipeId: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const title = lang === "ar" && recipe.title_ar ? recipe.title_ar : recipe.title;
  const cover = recipe.image_url ?? null;

  return (
    <article className="group relative overflow-hidden rounded-card border border-hair bg-white shadow-[var(--shadow-card)] transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)]">
      <Link
        to={`/recipe/${recipe.id}`}
        className="block focus-visible:outline-none"
        aria-label={title}
      >
        <span className="block aspect-[4/3] w-full overflow-hidden bg-cream-deep">
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-8 w-8 text-faint"
                fill="currentColor"
              >
                <path d="M12 1c.9 5.8 5.2 10.1 11 11-5.8.9-10.1 5.2-11 11-.9-5.8-5.2-10.1-11-11C6.8 11.1 11.1 6.8 12 1Z" />
              </svg>
            </span>
          )}
        </span>
        <span className="block px-4 pb-4 pt-3">
          <span className="line-clamp-2 min-h-[2.6em] font-body text-[15.5px] font-bold leading-snug tracking-tight text-ink">
            {title}
          </span>
          <TimeBadge
            size="sm"
            claimedMinutes={recipe.publisher_time_minutes}
            reallyMinutes={bestMinutes(recipe)}
            className="mt-2.5"
          />
        </span>
      </Link>

      {favorited != null && onToggleFavorite ? (
        <button
          type="button"
          onClick={() => onToggleFavorite(recipe.id)}
          aria-label={t("favorites.removeA11y", { title })}
          aria-pressed={favorited}
          className="absolute end-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-[var(--shadow-card)] transition-transform duration-150 hover:scale-105 active:translate-y-px"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 text-orange"
            fill={favorited ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={favorited ? 0 : 2}
          >
            <path d="M12 20C6 15.5 3 12.6 3 9.2 3 6.9 4.8 5 7.2 5c1.8 0 3.3 1 4.8 3 1.5-2 3-3 4.8-3C19.2 5 21 6.9 21 9.2c0 3.4-3 6.3-9 10.8Z" />
          </svg>
        </button>
      ) : null}
    </article>
  );
}
