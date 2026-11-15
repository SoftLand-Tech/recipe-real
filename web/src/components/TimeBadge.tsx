import { useFmtMinutes, useT } from "@/i18n";

import { cn } from "@/utils/cn";

/**
 * TimeBadge — the product's signature component (FOUNDATION OWNED).
 *
 * The claim-vs-reality pill pair from DESIGN.md's app mockups:
 *   - CLAIMED (orange): what the recipe says. Orange is the app's action/
 *     emphasis color and marks the publisher's own promise.
 *   - MEASURED (teal): what cooking it really takes. This is the ONLY place
 *     teal #287C78 may appear (THE TEAL IS TIME RULE) — it means
 *     community-measured time and nothing else.
 *
 * When both values are present the claimed value renders struck through (the
 * claim was contradicted), exactly like the landing's claim-vs-reality card.
 * Missing values simply drop their pill — a recipe without a measurement
 * never shows a teal element. RTL-safe: pure flex row, logical gaps only.
 */
export function TimeBadge({
  claimedMinutes,
  reallyMinutes,
  /** sm fits card rails (no labels, values only); md shows full labels. */
  size = "md",
  className,
}: {
  claimedMinutes: number | null | undefined;
  reallyMinutes: number | null | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useT();
  const fmt = useFmtMinutes();
  // Local narrowed copies: null when absent or non-positive, so the JSX and
  // aria-label below stay type-narrowed by direct !== null checks.
  const claimed =
    claimedMinutes != null && claimedMinutes > 0 ? claimedMinutes : null;
  const really =
    reallyMinutes != null && reallyMinutes > 0 ? reallyMinutes : null;

  if (claimed === null && really === null) return null;

  const pillBase =
    size === "sm"
      ? "gap-1.5 px-2.5 py-1 text-[12px]"
      : "gap-2 px-3.5 py-1.5 text-[13px]";

  // One announcement for both values keeps screen readers from reading a
  // bare "45m" with no context. (Direct !== null checks keep the template
  // literals type-narrowed.)
  const label =
    claimed !== null && really !== null
      ? `${t("common.claimed")} ${fmt(claimed)}, ${t("common.really")} ${fmt(really)}`
      : really !== null
        ? `${t("common.really")} ${fmt(really)}`
        : `${t("common.claimed")} ${fmt(claimed ?? 0)}`;

  return (
    <div
      className={cn("inline-flex flex-wrap items-center gap-2", className)}
      aria-label={label}
    >
      {claimed !== null ? (
        <span
          className={cn(
            "inline-flex items-center rounded-pill bg-orange-soft font-bold text-orange-deep",
            pillBase,
          )}
        >
          {size === "md" ? (
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">
              {t("common.claimed")}
            </span>
          ) : null}
          {/* Struck through when the measured value contradicts the claim. */}
          <span className={cn("tabular-nums", really !== null && "line-through")}>
            {fmt(claimed)}
          </span>
        </span>
      ) : null}
      {really !== null ? (
        <span
          className={cn(
            // TEAL: measured "really takes" time ONLY — see header comment.
            "inline-flex items-center rounded-pill bg-teal/10 font-bold text-teal",
            pillBase,
          )}
        >
          {size === "md" ? (
            <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">
              {t("common.really")}
            </span>
          ) : null}
          <span className="tabular-nums">{fmt(really)}</span>
        </span>
      ) : null}
    </div>
  );
}
