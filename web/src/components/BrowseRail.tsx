/**
 * BrowseRail — one curated home rail. OWNED BY SLICE BROWSE.
 *
 * Horizontal snap-scroll row of recipe cards on mobile (edge-bleeding past
 * the shell's side padding); a 4/5-column grid on desktop ≥768px, per the
 * brief ("horizontal rails on mobile, grids on desktop"). Empty rails render
 * nothing (mobile HomeRail parity). BrowseRailSkeleton is the loading shape.
 */
import { Link } from "react-router";

import type { Recipe } from "@/api/types";
import { BrowseRecipeCard } from "@/components/BrowseRecipeCard";
import { Skeleton } from "@/components/Skeleton";
import { useT } from "@/i18n";

/** Rail layout: flex-scroll below md, grid above (kept in one element so
 *  children keep a single markup shape in both modes). */
const RAIL_LAYOUT =
  "-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-5";

export function BrowseRail({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: Recipe[];
}) {
  const t = useT();
  if (items.length === 0) return null;
  return (
    <section className="mt-10 first:mt-0">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-[clamp(1.3rem,2.4vw,1.7rem)] font-semibold leading-tight text-ink">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 font-body text-[13.5px] text-muted">{subtitle}</p>
          ) : null}
        </div>
        <Link
          to="/browse"
          className="shrink-0 rounded-pill px-3 py-1.5 font-body text-[13.5px] font-bold text-orange-deep transition-colors hover:bg-orange-soft"
        >
          {t("common.seeAll")}
        </Link>
      </div>
      <div className={RAIL_LAYOUT}>
        {items.map((recipe) => (
          <BrowseRecipeCard
            key={recipe.id}
            recipe={recipe}
            className="w-40 shrink-0 snap-start md:w-auto"
          />
        ))}
      </div>
    </section>
  );
}

/** Loading shape for one rail: header + four skeleton cards. */
export function BrowseRailSkeleton({ title }: { title: string }) {
  return (
    <section className="mt-10 first:mt-0" aria-hidden="true">
      <div className="mb-4 px-1">
        <Skeleton className="h-7 w-48" />
        <span className="sr-only">{title}</span>
      </div>
      <div className={RAIL_LAYOUT}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-40 shrink-0 rounded-card border border-hair bg-white p-3 md:w-auto"
          >
            <Skeleton className="aspect-[3/4] w-full rounded-md" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}
