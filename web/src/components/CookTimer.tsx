/**
 * Live-tick cook timer components (slice RECIPE, Cook-prefixed shared).
 *
 * Web twins of mobile's memoized ElapsedTimer/StepPaceBar: while the
 * stopwatch runs, ONLY these small components re-render (every 500ms) — the
 * cook screen re-renders on real state changes only. The displayed value is
 * ALWAYS recomputed from wall-clock timestamps (Date.now diffs), never
 * accumulated from interval ticks, so any amount of throttled/backgrounded
 * time still shows the correct elapsed the moment the tab wakes.
 */
import { memo, useEffect, useState } from "react";

import { useT } from "@/i18n";
import { formatCookElapsed } from "@/routes/recipe/CookAlarms";
import { cn } from "@/utils/cn";

/** The display resolves to whole seconds; 500ms is plenty smooth. */
export const TICK_MS = 500;

/**
 * The whole-recipe stopwatch readout: pause-adjusted elapsed derived from
 * cookStartAt / pausedAt / pausedMsTotal, ticked by an internal interval
 * while `running` (and not currently paused — a pause freezes the display).
 */
export const CookElapsedTimer = memo(function CookElapsedTimer({
  cookStartAt,
  pausedAt,
  pausedMsTotal,
  running,
  className,
}: {
  cookStartAt: number | null;
  pausedAt: number | null;
  pausedMsTotal: number;
  /** Tick only while the stopwatch runs and is not paused. */
  running: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || cookStartAt == null || pausedAt != null) return;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(handle);
  }, [running, cookStartAt, pausedAt]);
  const elapsedMs =
    cookStartAt == null
      ? 0
      : Math.max(0, (pausedAt ?? now) - cookStartAt - pausedMsTotal);
  return (
    <span className={cn("tabular-nums", className)} aria-live="off">
      {formatCookElapsed(elapsedMs)}
    </span>
  );
});

/**
 * Per-step pace bar: teal fill toward this step's expected duration, orange
 * + over-count once past it (the honest-time glance — teal is reserved for
 * measured time, and this bar IS the live measurement).
 */
export const CookStepPaceBar = memo(function CookStepPaceBar({
  running,
  /** Session anchors: the frozen (not-running) value derives from these. */
  cookStartAt,
  pausedAt,
  /** Step number being timed (primitive so memoization holds). */
  stepNumber,
  /** Stable helper returning pause-adjusted elapsed ms on a step at `at`. */
  stepVisitElapsedMs,
  expectedMs,
  /** Parent-computed "~5m" / "~7m at your pace" label (calibration-aware). */
  expectedLabel,
  className,
}: {
  running: boolean;
  cookStartAt: number | null;
  pausedAt: number | null;
  stepNumber: number;
  stepVisitElapsedMs: (stepNumber: number, at: number) => number;
  expectedMs: number;
  expectedLabel: string;
  className?: string;
}) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const handle = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(handle);
  }, [running]);
  // Live while running; frozen-at-pause otherwise (pausedAt anchors the
  // pause instant; a null pausedAt with a live cookStartAt outside running
  // means the session is over — clamp to the start, never Date.now() in
  // render).
  const elapsedMs = running
    ? stepVisitElapsedMs(stepNumber, now)
    : cookStartAt != null
      ? stepVisitElapsedMs(stepNumber, pausedAt ?? cookStartAt)
      : 0;
  const overMin =
    elapsedMs > expectedMs
      ? Math.max(1, Math.round((elapsedMs - expectedMs) / 60_000))
      : 0;
  const pct = Math.min(1, expectedMs > 0 ? elapsedMs / expectedMs : 0);
  return (
    <div className={cn("w-full", className)}>
      <div
        className="h-1.5 overflow-hidden rounded-pill bg-cream-deep"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={Math.round(expectedMs / 60_000)}
        aria-valuenow={Math.round(elapsedMs / 60_000)}
        aria-label={t("cook.stepPaceA11y")}
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-300",
            // TEAL: measured time. Orange = past the estimate (emphasis,
            // mobile uses amber; the web palette has only orange).
            overMin > 0 ? "bg-orange" : "bg-teal",
          )}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 text-center text-[12.5px] font-bold",
          overMin > 0 ? "text-orange-deep" : "text-teal",
        )}
      >
        {overMin > 0
          ? t("cook.stepOver", { n: overMin })
          : expectedLabel}
      </p>
    </div>
  );
});
