/**
 * Quick-time contribution card (slice RECIPE): "Did you make this recipe?"
 *
 * Honest-breakdown form — plates made, hands-on minutes, total minutes
 * (required) and cleanup minutes — posted to /api/recipes/{id}/quick-time
 * when authed. A 401 (token absent/expired) surfaces the sign-in CTA instead
 * of a generic error. Mirrors mobile's QuickTimeCard copy + validation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { isOfflineError, isRateLimitedError } from "@/api/http";
import { isUnauthorizedError, submitQuickTime } from "@/api/cook";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useFmtMinutes, useT } from "@/i18n";
import { cn } from "@/utils/cn";

/** parseInt that yields null for blanks/non-numerics (mobile's parseIntOrNull). */
function parseIntOrNull(raw: string): number | null {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function RecipeQuickTimeCard({
  recipeId,
  onSubmitted,
  openSignal = 0,
}: {
  recipeId: number;
  /** Parent callback with the server-recomputed community average. */
  onSubmitted: (communityAvgMinutes: number | null) => void;
  /** Increment to force the form open (the "Be the first!" stat CTA). */
  openSignal?: number;
}) {
  const t = useT();
  const fmtMin = useFmtMinutes();

  const [open, setOpen] = useState(false);
  const [plates, setPlates] = useState("");
  const [handsOn, setHandsOn] = useState("");
  const [total, setTotal] = useState("");
  const [cleanup, setCleanup] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [avg, setAvg] = useState<number | null>(null);
  const [cleanupAvg, setCleanupAvg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const totalRef = useRef<HTMLInputElement | null>(null);

  const digitsOnly = useCallback(
    (setter: (v: string) => void) => (text: string) =>
      setter(text.replace(/[^0-9]/g, "").slice(0, 4)),
    [],
  );

  // Client-side guards mirroring mobile: total 1..1440 required; hands-on ≤
  // total; optional fields inside sane ranges.
  const totalValue = parseIntOrNull(total);
  const handsOnValue = parseIntOrNull(handsOn);
  const platesValue = parseIntOrNull(plates);
  const cleanupValue = parseIntOrNull(cleanup);
  const totalValid = totalValue != null && totalValue >= 1 && totalValue <= 1440;
  const handsOnExceeds =
    totalValid && handsOnValue != null && handsOnValue > totalValue;
  const valid =
    totalValid &&
    !handsOnExceeds &&
    (handsOnValue == null || (handsOnValue >= 0 && handsOnValue <= 1440)) &&
    (platesValue == null || (platesValue >= 1 && platesValue <= 50)) &&
    (cleanupValue == null || (cleanupValue >= 0 && cleanupValue <= 1440));

  const onSubmit = useCallback(async () => {
    const minutes = parseIntOrNull(total);
    if (minutes == null || minutes < 1 || minutes > 1440) return;
    const handsOnMinutes = parseIntOrNull(handsOn);
    if (handsOnMinutes != null && handsOnMinutes > minutes) return;
    const cleanupMinutes = parseIntOrNull(cleanup);
    const servings = parseIntOrNull(plates);
    setSubmitting(true);
    setError(null);
    setNeedsAuth(false);
    try {
      const result = await submitQuickTime(recipeId, {
        minutes,
        ...(handsOnMinutes != null ? { hands_on_minutes: handsOnMinutes } : {}),
        ...(cleanupMinutes != null ? { cleanup_minutes: cleanupMinutes } : {}),
        ...(servings != null ? { servings } : {}),
      });
      setAvg(result.community_avg_minutes);
      setCleanupAvg(result.cleanup_avg_minutes);
      setDone(true);
      setOpen(false);
      onSubmitted(result.community_avg_minutes);
    } catch (err) {
      if (isUnauthorizedError(err)) {
        setNeedsAuth(true);
        setError(t("recipe.quickSignInRequired"));
      } else if (isOfflineError(err)) {
        setError(t("common.offline"));
      } else if (isRateLimitedError(err)) {
        setError(t("common.rateLimited"));
      } else {
        setError(t("recipe.quickError"));
      }
    } finally {
      setSubmitting(false);
    }
  }, [total, handsOn, cleanup, plates, recipeId, onSubmitted, t]);

  const openForm = useCallback(() => {
    setDone(false);
    setOpen(true);
    // Focus the required total field once the input mounts.
    requestAnimationFrame(() => totalRef.current?.focus());
  }, []);

  // The parent's "Be the first!" stat nudges the card open via openSignal.
  const openSignalRef = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== openSignalRef.current) {
      openSignalRef.current = openSignal;
      openForm();
    }
  }, [openSignal, openForm]);

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { optional?: boolean; focusRef?: boolean } = {},
  ) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted">
        {label}
        {opts.optional ? (
          <span className="font-medium text-faint">
            {` · ${t("recipe.quickOptional")}`}
          </span>
        ) : null}
      </span>
      <input
        {...(opts.focusRef ? { ref: totalRef } : {})}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-hair bg-cream-deep px-3.5 py-2.5 font-body text-[15px] text-ink placeholder:text-faint focus-visible:bg-white"
      />
    </label>
  );

  return (
    <Card className="px-6 py-6">
      <button
        type="button"
        onClick={open ? () => setOpen(false) : openForm}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-md text-start"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-orange"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5M9 2h6" />
        </svg>
        <span className="flex-1 font-body text-[15px] font-bold text-ink">
          {t("recipe.quickDidYouMake")}
        </span>
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cn(
            "h-4 w-4 shrink-0 text-faint transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {done && !open ? (
        <p className="mt-3 text-[13.5px] font-bold text-teal">
          {avg != null
            ? t("recipe.quickThanksBreakdown", { time: fmtMin(avg) })
            : t("recipe.quickThanksOwnTime")}
          {cleanupAvg != null
            ? ` · ${t("recipe.quickThanksCleanup", { cleanup: fmtMin(cleanupAvg) })}`
            : ""}
        </p>
      ) : null}

      {open ? (
        <form
          className="mt-4 flex flex-col gap-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !submitting) void onSubmit();
          }}
        >
          {field(t("recipe.quickPlates"), plates, digitsOnly(setPlates), {
            optional: true,
          })}
          {field(t("recipe.quickHandsOn"), handsOn, digitsOnly(setHandsOn), {
            optional: true,
          })}
          {field(t("recipe.quickTotal"), total, digitsOnly(setTotal), {
            focusRef: true,
          })}
          {field(t("recipe.quickCleanup"), cleanup, digitsOnly(setCleanup), {
            optional: true,
          })}
          {handsOnExceeds ? (
            <p className="text-[13px] font-semibold text-orange-deep">
              {t("recipe.quickHandsOnTooLong")}
            </p>
          ) : null}
          <Button type="submit" disabled={!valid} loading={submitting}>
            {t("recipe.quickSubmit")}
          </Button>
          {error != null ? (
            <p className="text-[13px] font-semibold text-orange-deep" role="alert">
              {error}
            </p>
          ) : null}
          {needsAuth ? (
            <Link
              to="/login"
              className="self-start font-body text-[13.5px] font-extrabold text-orange-deep hover:underline"
            >
              {t("common.signIn")}
            </Link>
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}
