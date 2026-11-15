/**
 * Reality Index leaderboard (route /reality) — OWNED BY SLICE BROWSE.
 *
 * GET /api/reality?mode=under|over: the recipes whose honest time diverges
 * most from the publisher's claim. Each row leads with the TimeBadge pair
 * (claimed struck-through vs measured teal) plus the measured gap percent —
 * teal appears only for these measured-time values, per the palette
 * contract. Mode toggle switches between "takes longer" and "faster than
 * claimed" orderings; failures surface an error + retry (429 → friendly
 * toast, never a crash).
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { isRateLimitedError } from "@/api/http";
import { bestMinutes, localizedTitle } from "@/api/recipes";
import { fetchRealityRows, type RealityMode } from "@/api/reality";
import type { Recipe } from "@/api/types";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { TimeBadge } from "@/components/TimeBadge";
import { useToast } from "@/components/Toast";
import { useFmtMinutes, useLang, useT } from "@/i18n";
import { cn } from "@/utils/cn";

/** Leaderboard length (server clamps take to 1..50). */
const REALITY_TAKE = 30;

/** One leaderboard row: rank, photo, title, claimed-vs-really, gap, source. */
function RealityRow({ recipe, rank }: { recipe: Recipe; rank: number }) {
  const t = useT();
  const fmt = useFmtMinutes();
  const { lang } = useLang();
  const title = localizedTitle(recipe, lang);
  const reality = recipe.reality;
  const gapPct = reality?.gap_pct;

  return (
    <Card as="li" className="relative overflow-hidden">
      <Link
        to={`/recipe/${recipe.id}`}
        aria-label={title}
        className="grid grid-cols-[2.25rem_1fr] items-center gap-x-4 gap-y-2 p-3.5 after:absolute after:inset-0 after:content-[''] sm:grid-cols-[2.5rem_6rem_1fr_auto] md:p-4"
      >
        <span className="text-center font-display text-[1.35rem] font-semibold text-faint">
          {rank}
        </span>
        {recipe.image_url != null ? (
          <img
            src={recipe.image_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="col-start-2 row-start-1 hidden h-24 w-24 rounded-md object-cover sm:block"
          />
        ) : (
          <span
            className="col-start-2 row-start-1 hidden h-24 w-24 rounded-md bg-cream-deep sm:block"
            aria-hidden="true"
          />
        )}
        <div className="col-start-2 row-start-1 min-w-0 sm:col-start-3">
          <h3 className="line-clamp-1 font-body text-[15px] font-bold text-ink">
            {title}
          </h3>
          <TimeBadge
            claimedMinutes={recipe.publisher_time_minutes}
            reallyMinutes={bestMinutes(recipe)}
            size="sm"
            className="mt-1.5"
          />
          {reality != null ? (
            <p className="mt-1.5 font-body text-[12.5px] text-faint">
              {reality.source === "community"
                ? t("reality.fromCooks", { n: reality.samples })
                : t("reality.aiEstimate")}
            </p>
          ) : null}
        </div>
        {/* Measured gap (teal: measured-time information only). Wraps under
            the text on phones, sits at the row end from sm up. */}
        {gapPct != null && Math.round(gapPct) !== 0 ? (
          <span
            className={cn(
              "col-start-2 row-start-2 justify-self-start rounded-pill bg-teal/10 px-3 py-1.5 font-body text-[13px] font-bold text-teal",
              "sm:col-start-4 sm:row-start-1 sm:justify-self-end",
            )}
          >
            {gapPct > 0
              ? t("reality.longerPct", { pct: Math.round(gapPct) })
              : t("reality.shorterPct", { pct: Math.abs(Math.round(gapPct)) })}
            {reality != null && reality.gap_minutes > 0 ? (
              <span className="ms-1.5 font-semibold">
                (+{fmt(reality.gap_minutes)})
              </span>
            ) : null}
          </span>
        ) : null}
      </Link>
    </Card>
  );
}

export default function RealityPage() {
  const t = useT();
  // The ToastProvider's api object is referentially stable for the app's
  // lifetime, so it can sit in fetch-effect deps without re-triggering.
  const toast = useToast();
  const [mode, setMode] = useState<RealityMode>("under");
  // Settled load, stamped with the mode+retry key it answers (keyed-state
  // pattern: no synchronous setState in the fetch effect).
  const [result, setResult] = useState<{ key: string; rows: Recipe[] } | null>(
    null,
  );
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Latest translator, synced after render (react-hooks/refs contract).
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const key = `${mode}#${retryNonce}`;
  const current = result?.key === key ? result.rows : null;
  const failed = failedKey === key && current == null;
  const loading = current == null && !failed;

  useEffect(() => {
    let active = true;
    fetchRealityRows(mode, REALITY_TAKE)
      .then((nextRows) => {
        if (!active) return;
        setResult({ key, rows: nextRows });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (isRateLimitedError(error)) {
          toast.error(tRef.current("common.rateLimited"));
        }
        setFailedKey(key);
      });
    return () => {
      active = false;
    };
  }, [key, mode, retryNonce, toast]);

  return (
    <div>
      <h1 className="font-display text-[clamp(1.7rem,3.2vw,2.4rem)] font-semibold leading-tight text-ink">
        {t("reality.pageTitle")}
      </h1>
      <p className="mt-2 max-w-2xl font-body text-[15px] leading-relaxed text-muted">
        {t("reality.pageSubtitle")}
      </p>

      {/* Mode toggle. */}
      <div className="mt-5 flex w-fit gap-1.5 rounded-pill border border-hair bg-white p-1.5">
        {(
          [
            { id: "under", key: "reality.modeUnder" },
            { id: "over", key: "reality.modeOver" },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => setMode(option.id)}
            className={cn(
              "rounded-pill px-4 py-2 font-body text-[14px] font-bold transition-colors md:px-5",
              mode === option.id
                ? "bg-orange-soft text-orange-deep"
                : "text-muted hover:text-ink",
            )}
          >
            {t(option.key)}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {loading ? (
          <ol className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li
                key={i}
                className="flex items-center gap-4 rounded-card border border-hair bg-white p-4"
              >
                <Skeleton className="h-7 w-7" />
                <Skeleton className="h-20 w-20 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-6 w-44 rounded-pill" />
                </div>
              </li>
            ))}
          </ol>
        ) : failed ? (
          <EmptyState
            title={t("common.error")}
            body={t("common.offline")}
            action={
              <Button onClick={() => setRetryNonce((n) => n + 1)}>
                {t("common.retry")}
              </Button>
            }
          />
        ) : current == null || current.length === 0 ? (
          <EmptyState
            title={t("reality.emptyTitle")}
            body={t("reality.emptyBody")}
          />
        ) : (
          <ol className="space-y-3">
            {current.map((recipe, index) => (
              <RealityRow key={recipe.id} recipe={recipe} rank={index + 1} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
