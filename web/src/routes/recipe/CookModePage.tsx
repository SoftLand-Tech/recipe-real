/**
 * Full-screen Cook Mode (route /cook/:id) — OWNED BY SLICE RECIPE.
 *
 * The product's differentiating feature, ported from mobile's
 * app/cook/[id].tsx to web primitives:
 *   - immersive full-screen WITHOUT touching routes.tsx: this route renders
 *     a `fixed inset-0 z-50` overlay above the app shell (nav bars included)
 *     and locks body scroll while mounted;
 *   - a whole-recipe stopwatch whose elapsed is ALWAYS computed from
 *     wall-clock timestamps (cookStartAt/pausedAt/pausedMsTotal) — interval
 *     ticks only refresh the display, so background throttling never drifts
 *     the clock;
 *   - per-step timing via a visit log (Back/Next loiter is attributed to the
 *     step on screen), pause intervals subtracted;
 *   - step alarms as wall-clock deadlines checked by the live tick: Web
 *     Audio beep (context primed on the Start gesture) + a system
 *     Notification when permitted — both degrade gracefully;
 *   - pace calibration (authed): step expectations scaled by the cook's
 *     per-type multipliers; anonymous users see publisher estimates with a
 *     sign-in nudge;
 *   - finish → feedback (faster/as-expected/slower + optional manual time
 *     adjustment that rescales per-step timings) → POST /api/cook-sessions
 *     with mobile's exact payload. Cooking is allowed signed-out; the
 *     session is only uploaded when authed (otherwise a gentle notice).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate, useParams } from "react-router";

import { isOfflineError } from "@/api/http";
import {
  fetchPaceCalibrations,
  fetchRecipe,
  submitCookSession,
} from "@/api/cook";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { CookElapsedTimer, CookStepPaceBar } from "@/components/CookTimer";
import { useFmtMinutes, useT } from "@/i18n";
import type {
  CookSessionPayload,
  Feedback,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/api/types";
import {
  makeIdempotencyKey,
  playAlarmBeep,
  primeAudioContext,
  requestAlarmPermission,
  showAlarmNotification,
} from "@/routes/recipe/CookAlarms";
import { estimateStepMinutes } from "@/routes/recipe/RecipeTimeMath";
import { stepTypeLabel, useLocalizedRecipe } from "@/routes/recipe/RecipeLocalizedText";
import { cn } from "@/utils/cn";

type LoadState = "loading" | "ready" | "error";
type Phase = "cooking" | "feedback" | "submitting" | "done";
/** Whole-recipe stopwatch state. */
type CookStatus = "idle" | "running" | "paused" | "finished";

/** localStorage key persisting the large-text preference. */
const LARGE_TEXT_KEY = "rr_cook_large_text";

// ---- Whole-recipe stopwatch math (port of mobile) -------------------------

/** One closed pause interval of the stopwatch, in wall-clock epoch ms. */
interface PauseInterval {
  from: number;
  to: number;
}

/**
 * One visit to a step: wall-clock entry instant + exit instant (null while
 * the visit is still open). Revisits append new entries — per-step time is
 * the SUM of a step's visits, so Back-then-Next loiter is attributed to the
 * step actually on screen.
 */
interface StepVisit {
  stepNumber: number;
  from: number;
  to: number | null;
}

/** Round to 2 decimals (matches the submission spec). */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Pause-adjusted duration of the wall-clock segment [from, to]: its raw
 * length minus any pause time overlapping it. The single place pause time
 * is subtracted, shared by the live display and the per-step durations.
 */
function adjust(from: number, to: number, pauses: PauseInterval[]): number {
  const ms = Math.max(0, to - from);
  if (ms === 0) return 0;
  let overlap = 0;
  for (const p of pauses) {
    const lo = Math.max(from, p.from);
    const hi = Math.min(to, p.to);
    if (hi > lo) overlap += hi - lo;
  }
  return Math.max(0, ms - overlap);
}

/** Submission summary — the exact shape the calibration pipeline consumes. */
interface CookSummary {
  perStep: { step: RecipeStep; actual_minutes: number }[];
  cleanup_minutes: number | null;
  total_actual_minutes: number;
}

// ---- Small presentational bits ---------------------------------------------

/** One circular step-nav control flanking the Pause/Resume pill. */
function CircleButton({
  label,
  onClick,
  disabled,
  filled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-pill border transition-colors",
        filled
          ? "border-transparent bg-orange text-white hover:bg-orange-deep"
          : "border-hair bg-cream-deep text-muted hover:text-ink",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/** Centered modal confirmation (finish / discard) over the immersive view. */
function ConfirmCard({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <Card className="w-full max-w-sm px-6 py-6 text-center">
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-2.5">
          <Button onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ---- Screen ----------------------------------------------------------------

export default function CookModePage() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const validId = Number.isFinite(numericId) && numericId > 0;

  const t = useT();
  const fmtMin = useFmtMinutes();
  const navigate = useNavigate();
  const lr = useLocalizedRecipe();
  const { status: authStatus } = useAuth();
  const authed = authStatus === "authed";

  // ---- Load recipe ---------------------------------------------------------
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  /** Error kind stored untyped-translation-free; rendered via t() at paint. */
  const [errorKind, setErrorKind] = useState<"offline" | "generic" | null>(null);
  const loadRequestIdRef = useRef(0);

  const loadRecipe = useCallback(async () => {
    if (!validId) {
      setErrorKind("generic");
      setLoadState("error");
      return;
    }
    const requestId = ++loadRequestIdRef.current;
    setLoadState("loading");
    setErrorKind(null);
    try {
      const fetched = await fetchRecipe(id!);
      if (requestId !== loadRequestIdRef.current) return;
      setRecipe(fetched);
      setLoadState("ready");
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      setErrorKind(isOfflineError(error) ? "offline" : "generic");
      setLoadState("error");
    }
  }, [id, validId]);

  useEffect(() => {
    // Deferred one microtask: the loader setStates synchronously (loading
    // state + invalid-id error) which the hooks lint forbids directly in
    // an effect body.
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void loadRecipe();
    });
    return () => {
      cancelled = true;
    };
  }, [loadRecipe]);

  // ---- Pace calibrations (authed) ------------------------------------------
  // Fetched only while authed; the ANON case is derived at the use site
  // (`authed ? fetched : []`) instead of a sync setState here.
  const [fetchedCalibrations, setFetchedCalibrations] = useState<
    PaceCalibration[]
  >([]);
  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    fetchPaceCalibrations()
      .then((items) => {
        if (!cancelled) setFetchedCalibrations(items);
      })
      .catch(() => {
        // Estimates fall back to publisher/community values.
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);
  const calibrations = useMemo(
    () => (authed ? fetchedCalibrations : []),
    [authed, fetchedCalibrations],
  );

  const paceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of calibrations) map.set(c.step_type, c.multiplier);
    return map;
  }, [calibrations]);

  const steps: RecipeStep[] = useMemo(
    () => recipe?.recipe_steps ?? [],
    [recipe],
  );

  // ---- Immersive overlay plumbing -------------------------------------------
  // Lock body scroll while the overlay is mounted, whatever happens below.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const [phase, setPhase] = useState<Phase>("cooking");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // ---- Stopwatch state -------------------------------------------------------
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Wall-clock instant the cook started; null until Start is pressed. */
  const [cookStartAt, setCookStartAt] = useState<number | null>(null);
  /** Sync ref mirror so same-turn handlers see the start immediately. */
  const cookStartAtRef = useRef<number | null>(null);
  /** Wall-clock instant the screen hydrated (fallback if finished without Start). */
  const screenEnteredAtRef = useRef<number>(0);
  useEffect(() => {
    if (screenEnteredAtRef.current === 0) {
      screenEnteredAtRef.current = Date.now();
    }
  }, []);
  /** Total ms spent paused across all completed pause intervals. */
  const [pausedMsTotal, setPausedMsTotal] = useState(0);
  /** Set while paused (the instant the pause began); null while running. */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<CookStatus>("idle");
  const statusRef = useRef<CookStatus>("idle");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /** Pause log (closed intervals) — subtracted from each step's segments. */
  const pausesRef = useRef<PauseInterval[]>([]);
  /** Wall-clock instant each step was FIRST entered (drives visited dots). */
  // First-entry marks per step (visited dots). State, not a ref: the dot
  // row renders from it (refs must never be read during render).
  const [stepMarks, setStepMarks] = useState<Record<number, number>>({});
  /** Segment log: every (enter, exit) visit per step. */
  const visitsRef = useRef<StepVisit[]>([]);

  // ---- Feedback / submit state ------------------------------------------------
  const [summary, setSummary] = useState<CookSummary | null>(null);
  const [submitMsgKind, setSubmitMsgKind] = useState<
    "saved" | "error" | "needsAuth" | null
  >(null);
  // Manual time adjustment (feedback phase): null = the stopwatch stands.
  const [adjustedTotal, setAdjustedTotal] = useState<number | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustDraft, setAdjustDraft] = useState("");
  const idempotencyKeyRef = useRef("");

  /** Leave Cook Mode: back to the recipe detail (never strays out of /app). */
  const leave = useCallback(() => {
    navigate(validId ? `/recipe/${numericId}` : "/", { replace: true });
  }, [navigate, validId, numericId]);

  const requestClose = useCallback(() => {
    if (confirmFinish || confirmDiscard) return;
    const sessionActive = phase === "cooking" && cookStartAtRef.current != null;
    if (sessionActive) {
      setConfirmDiscard(true);
      return;
    }
    leave();
  }, [phase, confirmFinish, confirmDiscard, leave]);

  // Escape = the web's hardware-back affordance: confirm-before-discard on an
  // active session (mobile intercepts Back the same way), close confirmations
  // when one is already open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (confirmFinish) {
        setConfirmFinish(false);
        return;
      }
      if (confirmDiscard) {
        setConfirmDiscard(false);
        return;
      }
      requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose, confirmFinish, confirmDiscard]);

  // ---- Step alarm (wall-clock deadline + beep + Notification) ----------------
  const [armedStep, setArmedStep] = useState<number | null>(null);
  const alarmAtRef = useRef<number | null>(null);
  /** Step whose alarm just fired — a transient "time's up" banner. */
  const [alarmFiredStep, setAlarmFiredStep] = useState<number | null>(null);
  /** Step the user manually DISARMED (auto-arm must not fight them). */
  const lastAutoArmStepRef = useRef<number | null>(null);

  const clearArmedAlarm = useCallback(() => {
    alarmAtRef.current = null;
    setArmedStep(null);
  }, []);

  const fireAlarm = useCallback(
    (stepNumber: number, minutes: number) => {
      playAlarmBeep();
      showAlarmNotification(
        t("cook.alarmDoneTitle"),
        t("cook.alarmDoneBody", { n: stepNumber, minutes: Math.round(minutes) }),
      );
      setAlarmFiredStep(stepNumber);
      window.setTimeout(() => {
        setAlarmFiredStep((curr) => (curr === stepNumber ? null : curr));
      }, 8000);
    },
    [t],
  );

  /** The overdue check — run by the tick interval AND on tab re-focus. */
  const checkAlarmRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (armedStep == null) return;
    const check = () => {
      const at = alarmAtRef.current;
      if (at == null || armedStep == null) return;
      if (Date.now() >= at) {
        const minutes =
          steps.find((s) => s.step_number === armedStep)?.literal_minutes ?? 0;
        alarmAtRef.current = null;
        setArmedStep(null);
        fireAlarm(armedStep, minutes);
      }
    };
    checkAlarmRef.current = check;
    check();
    const handle = window.setInterval(check, 500);
    return () => {
      window.clearInterval(handle);
      checkAlarmRef.current = () => {};
    };
  }, [armedStep, steps, fireAlarm]);

  // ---- Page visibility: warn (never block) when the tab hides mid-cook ------
  const hiddenWhileRunningRef = useRef(false);
  const [showTabNotice, setShowTabNotice] = useState(false);
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // A throttled background tab may have missed the tick: re-check the
        // armed alarm deadline the moment the tab wakes.
        checkAlarmRef.current();
        if (hiddenWhileRunningRef.current) {
          hiddenWhileRunningRef.current = false;
          if (statusRef.current === "running") {
            setShowTabNotice(true);
            window.setTimeout(() => setShowTabNotice(false), 5000);
          }
        }
      } else if (statusRef.current === "running") {
        hiddenWhileRunningRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ---- Large text preference -------------------------------------------------
  // Read once at mount (lazy initializer — a sync localStorage read is fine
  // in an initializer, and it avoids the setState-in-effect dance).
  const [largeText, setLargeText] = useState(() => {
    try {
      return window.localStorage.getItem(LARGE_TEXT_KEY) === "true";
    } catch {
      return false;
    }
  });
  const toggleLargeText = useCallback(() => {
    setLargeText((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(LARGE_TEXT_KEY, String(next));
      } catch {
        // Best-effort persistence.
      }
      return next;
    });
  }, []);

  // ---- Step marks & start ------------------------------------------------------
  /**
   * Enter step `i` (post-Start): close the currently open visit at `at`,
   * stamp the first-entry mark (visited dots), and open a new visit for this
   * step. Revisits append visits — durations sum them.
   */
  const recordMark = useCallback(
    (i: number, atOverride?: number) => {
      if (cookStartAtRef.current == null && cookStartAt == null) return;
      const stepNumber = steps[i]?.step_number;
      if (stepNumber == null) return;
      const at = atOverride ?? Date.now();
      const visits = visitsRef.current;
      for (let k = visits.length - 1; k >= 0; k--) {
        if (visits[k].to == null) {
          visits[k].to = Math.max(at, visits[k].from);
          break;
        }
      }
      setStepMarks((prev) =>
        prev[stepNumber] == null ? { ...prev, [stepNumber]: at } : prev,
      );
      visits.push({ stepNumber, from: at, to: null });
    },
    [cookStartAt, steps],
  );

  const startCooking = useCallback(() => {
    if (!recipe || cookStartAtRef.current != null || cookStartAt != null) return;
    // Audio + notifications need a user gesture to be allowed at all.
    primeAudioContext();
    requestAlarmPermission();
    const at = Date.now();
    cookStartAtRef.current = at;
    setCookStartAt(at);
    setPausedMsTotal(0);
    setPausedAt(null);
    statusRef.current = "running";
    setStatus("running");
    recordMark(currentIndex, at);
  }, [recipe, cookStartAt, currentIndex, recordMark]);

  /** Arm (or cancel, when already armed) the alarm for the current step. */
  const armStepAlarm = useCallback(
    (step: RecipeStep): boolean => {
      const minutes = step.literal_minutes;
      if (typeof minutes !== "number" || minutes <= 0) return false;
      clearArmedAlarm();
      alarmAtRef.current = Date.now() + minutes * 60_000;
      setArmedStep(step.step_number);
      return true;
    },
    [clearArmedAlarm],
  );

  const onAlarmChipPress = useCallback(() => {
    const step = steps[currentIndex];
    if (!step) return;
    if (armedStep === step.step_number) {
      lastAutoArmStepRef.current = step.step_number;
      clearArmedAlarm();
      return;
    }
    lastAutoArmStepRef.current = null;
    setAlarmFiredStep(null);
    if (statusRef.current === "idle") {
      startCooking();
    }
    armStepAlarm(step);
  }, [steps, currentIndex, armedStep, clearArmedAlarm, armStepAlarm, startCooking]);

  // AUTO-ARM: entering a timed step while the stopwatch runs starts its
  // alarm automatically. A manual cancel on this step suppresses the re-arm
  // until the user leaves and comes back.
  useEffect(() => {
    if (phase !== "cooking" || status !== "running") return;
    const step = steps[currentIndex];
    if (!step) return;
    const minutes = step.literal_minutes;
    if (typeof minutes !== "number" || minutes <= 0) return;
    if (armedStep != null) return;
    if (lastAutoArmStepRef.current === step.step_number) return;
    armStepAlarm(step);
    // Fires on step ENTRY (and run resume) only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, status, phase, steps]);

  // ---- Pause / finish ------------------------------------------------------
  const togglePauseResume = useCallback(() => {
    if (!recipe || cookStartAt == null) return;
    if (status === "running") {
      setPausedAt(Date.now());
      setStatus("paused");
    } else if (status === "paused") {
      const at = Date.now();
      let newTotal = pausedMsTotal;
      if (pausedAt != null) {
        pausesRef.current.push({ from: pausedAt, to: at });
        newTotal = pausedMsTotal + (at - pausedAt);
        setPausedMsTotal(newTotal);
      }
      setPausedAt(null);
      setStatus("running");
    }
  }, [recipe, cookStartAt, status, pausedAt, pausedMsTotal]);

  /** Finish: freeze the stopwatch, derive per-step durations from the visit
   *  log (unvisited steps submit 0) and move to the feedback phase. */
  const finishCooking = useCallback(() => {
    if (!recipe || phase !== "cooking") return;
    const now = Date.now();
    const effectiveStartAt =
      cookStartAt ?? cookStartAtRef.current ?? (screenEnteredAtRef.current || now);
    const endWall = pausedAt ?? now;
    const finalAccumPausedMs =
      pausedMsTotal + (pausedAt != null ? Math.max(0, now - pausedAt) : 0);
    const sessionElapsedMs = Math.max(
      0,
      now - effectiveStartAt - finalAccumPausedMs,
    );
    const pauses = pausesRef.current;
    const visits = visitsRef.current;

    if (
      cookStartAt == null &&
      cookStartAtRef.current == null &&
      visits.length === 0 &&
      sessionElapsedMs > 0 &&
      steps[currentIndex] != null
    ) {
      // Finished without pressing Start: attribute elapsed screen time to the
      // active step so per-step timings stay consistent with the total.
      visits.push({
        stepNumber: steps[currentIndex].step_number,
        from: effectiveStartAt,
        to: Math.max(endWall, effectiveStartAt),
      });
    } else {
      // Close the still-open visit at the finish instant so the tail of the
      // current step is counted exactly once.
      for (let k = visits.length - 1; k >= 0; k--) {
        if (visits[k].to == null) {
          visits[k].to = Math.max(endWall, visits[k].from);
          break;
        }
      }
    }

    let perStep = steps.map((step) => {
      let ms = 0;
      for (const seg of visits) {
        if (seg.stepNumber !== step.step_number || seg.to == null) continue;
        ms += adjust(seg.from, seg.to, pauses);
      }
      return { step, actual_minutes: round2(Math.max(0, ms) / 60000) };
    });

    const hasNonCleanup =
      perStep.filter((p) => p.step.step_type !== "cleanup").length > 0;
    const isCountedInTotal = (p: { step: RecipeStep }) =>
      hasNonCleanup ? p.step.step_type !== "cleanup" : true;

    const summedStepMinutes = round2(
      perStep
        .filter(isCountedInTotal)
        .reduce((sum, p) => sum + p.actual_minutes, 0),
    );
    const rawTotalMinutes = Math.max(
      summedStepMinutes,
      round2(sessionElapsedMs / 60000),
    );
    const totalActualMinutes =
      sessionElapsedMs > 0
        ? Math.max(1, Math.round(rawTotalMinutes))
        : rawTotalMinutes;

    // Keep per-step timings aligned with the total when time was spent.
    if (totalActualMinutes > 0 && summedStepMinutes !== totalActualMinutes) {
      if (summedStepMinutes > 0) {
        const factor = totalActualMinutes / summedStepMinutes;
        perStep = perStep.map((p) =>
          isCountedInTotal(p)
            ? { ...p, actual_minutes: round2(p.actual_minutes * factor) }
            : p,
        );
      } else if (perStep.length > 0) {
        const targetIdx = perStep.findIndex(
          (p, idx) => idx === currentIndex && isCountedInTotal(p),
        );
        const fallbackIdx =
          targetIdx >= 0
            ? targetIdx
            : perStep.findIndex((p) => isCountedInTotal(p));
        const chosenIdx = fallbackIdx >= 0 ? fallbackIdx : 0;
        perStep = perStep.map((p, idx) =>
          idx === chosenIdx
            ? { ...p, actual_minutes: totalActualMinutes }
            : p,
        );
      }
    }

    const cleanupSum =
      round2(
        perStep
          .filter((p) => p.step.step_type === "cleanup")
          .reduce((sum, p) => sum + p.actual_minutes, 0),
      ) || null;

    statusRef.current = "finished";
    setStatus("finished");
    setSummary({
      perStep,
      cleanup_minutes: cleanupSum,
      total_actual_minutes: totalActualMinutes,
    });
    setAdjustedTotal(null);
    setAdjustOpen(false);
    setAdjustDraft("");
    setPhase("feedback");
    clearArmedAlarm();
  }, [
    recipe,
    phase,
    cookStartAt,
    pausedAt,
    pausedMsTotal,
    currentIndex,
    steps,
    clearArmedAlarm,
  ]);

  // ---- Step navigation ------------------------------------------------------
  const goToStep = useCallback(
    (i: number) => {
      if (i === currentIndex) return;
      clearArmedAlarm();
      setAlarmFiredStep(null);
      lastAutoArmStepRef.current = null;
      if (statusRef.current === "idle") {
        startCooking();
      }
      setCurrentIndex(i);
      recordMark(i);
    },
    [currentIndex, clearArmedAlarm, startCooking, recordMark],
  );

  const nextStep = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      goToStep(currentIndex + 1);
    } else {
      setConfirmFinish(true);
    }
  }, [currentIndex, steps.length, goToStep]);

  const prevStep = useCallback(() => {
    goToStep(Math.max(0, currentIndex - 1));
  }, [goToStep, currentIndex]);

  /**
   * Pause-adjusted time spent ON step `stepNumber` up to wall instant `at`:
   * closed visits summed plus the open visit's live portion. Stable (reads
   * refs only) — shared by the frozen snapshot and the ticking pace bar.
   */
  const stepVisitElapsedMs = useCallback(
    (stepNumber: number, at: number): number => {
      let ms = 0;
      for (const seg of visitsRef.current) {
        if (seg.stepNumber !== stepNumber) continue;
        const end = seg.to ?? at;
        if (end >= seg.from) ms += adjust(seg.from, end, pausesRef.current);
      }
      return Math.max(0, ms);
    },
    [],
  );

  // ---- Feedback / submit ------------------------------------------------------
  const handleSubmit = useCallback(
    async (feedback: Feedback | null) => {
      if (!recipe || !summary) return;
      // Manual adjustment: scale every per-step timing by adjusted/measured so
      // the submitted total and the pace data stay consistent.
      const measuredTotal = summary.total_actual_minutes;
      let effTotal = measuredTotal;
      let effPerStep = summary.perStep;
      let effCleanup = summary.cleanup_minutes;
      if (
        adjustedTotal != null &&
        measuredTotal > 0 &&
        adjustedTotal !== measuredTotal
      ) {
        const factor = adjustedTotal / measuredTotal;
        effPerStep = summary.perStep.map((p) => ({
          ...p,
          actual_minutes: round2(Math.max(0, p.actual_minutes * factor)),
        }));
        effCleanup =
          round2(
            effPerStep
              .filter((p) => p.step.step_type === "cleanup")
              .reduce((sum, p) => sum + p.actual_minutes, 0),
          ) || null;
        effTotal = adjustedTotal;
      }
      setPhase("submitting");
      setSubmitMsgKind(null);
      setAdjustOpen(false);
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = makeIdempotencyKey();
      }
      const payload: CookSessionPayload = {
        recipe_id: recipe.id,
        total_actual_minutes: effTotal,
        cleanup_minutes: effCleanup,
        feedback,
        idempotency_key: idempotencyKeyRef.current,
        timing_submissions: effPerStep.map((p) => ({
          recipe_step_id: p.step.id,
          actual_minutes: p.actual_minutes,
        })),
      };

      if (!authed) {
        // Cooking is allowed signed-out; the session is simply not uploaded.
        setSubmitMsgKind("needsAuth");
        setPhase("done");
        return;
      }
      try {
        await submitCookSession(payload);
        setSubmitMsgKind("saved");
      } catch {
        setSubmitMsgKind("error");
      }
      setPhase("done");
    },
    [recipe, summary, adjustedTotal, authed],
  );

  // ---- Render: loading -------------------------------------------------------
  if (loadState === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-cream">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5 px-6">
          <Skeleton className="h-4 w-24 self-center" />
          <Skeleton className="h-16 w-48 self-center" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    );
  }

  // ---- Render: error (bad id / 404 / offline) — clean, never a crash -------
  if (loadState === "error" || !recipe) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-cream">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            {t("common.error")}
          </h1>
          <p className="text-[15px] leading-relaxed text-muted">
            {errorKind === "offline" ? t("common.offline") : t("cook.loadFailed")}
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => void loadRecipe()}>{t("common.retry")}</Button>
            {validId ? (
              <Button variant="ghost" onClick={leave}>
                {t("common.back")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => navigate("/", { replace: true })}>
                {t("common.goHome")}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Render: no steps -------------------------------------------------------
  if (steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-cream">
        <div className="flex items-center justify-end px-5 pt-5">
          <button
            type="button"
            onClick={() =>
              navigate(`/recipe/${recipe.id}`, { replace: true })
            }
            aria-label={t("cook.closeA11y")}
            className="flex h-10 w-10 items-center justify-center rounded-pill bg-cream-deep text-muted transition-colors hover:text-ink"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-[15px] text-muted">{t("cook.noSteps")}</p>
        </div>
      </div>
    );
  }

  // ---- Render: feedback / submitting / done -----------------------------------
  if (phase === "feedback" || phase === "submitting" || phase === "done") {
    const submitting = phase === "submitting";
    const measuredTotal = summary?.total_actual_minutes ?? 0;
    const totalCooked = adjustedTotal ?? measuredTotal;
    const cleanupMinutes = summary?.cleanup_minutes ?? null;
    const publisherMinutes =
      recipe.publisher_time_minutes != null
        ? Math.round(recipe.publisher_time_minutes)
        : null;
    const cleanupEstimate =
      recipe.cleanup_estimate_minutes ?? recipe.cleanup_avg_minutes ?? null;
    const feedbackOptions: { value: Feedback; title: string; subtitle: string }[] = [
      { value: "faster", title: t("cook.faster"), subtitle: t("cook.fasterSub") },
      {
        value: "as_expected",
        title: t("cook.asExpected"),
        subtitle: t("cook.asExpectedSub"),
      },
      { value: "slower", title: t("cook.slower"), subtitle: t("cook.slowerSub") },
    ];

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-cream">
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center gap-5 px-5 py-10">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-soft">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 text-orange" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 3v8a3 3 0 0 0 6 0V4a2 2 0 1 0-4 0v7a4 4 0 0 0 8 0V4" transform="rotate(45 12 12) translate(0 -1)" />
              <circle cx="12" cy="12" r="2.4" />
            </svg>
          </span>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            {t("cook.youCooked")}
          </h1>
          <p className="-mt-3 text-center text-[14px] font-semibold text-muted">
            {lr.title(recipe)}
          </p>

          {/* Stat compare: your measured time (teal) vs the publisher claim. */}
          <Card className="w-full px-6 py-6">
            <div className="flex items-center">
              <div className="flex flex-1 flex-col items-center gap-1">
                {/* TEAL: measured time only. */}
                <span className="font-display text-3xl font-extrabold tabular-nums text-teal">
                  {fmtMin(totalCooked)}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-faint">
                  {t("cook.yourTime")}
                </span>
              </div>
              {publisherMinutes != null ? (
                <>
                  <div className="h-14 w-px bg-hair" aria-hidden="true" />
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <span className="font-display text-3xl font-extrabold tabular-nums text-muted">
                      {fmtMin(publisherMinutes)}
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-faint">
                      {t("cook.publisherEst")}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
            {cleanupMinutes != null || cleanupEstimate != null ? (
              <>
                <div className="my-4 h-px bg-hair" aria-hidden="true" />
                <p className="text-center text-[13px] font-semibold text-muted">
                  {cleanupMinutes != null
                    ? t("cook.cleanupLabel", { time: fmtMin(cleanupMinutes) })
                    : t("cook.cleanupEstimate", {
                        n: Math.round(cleanupEstimate!),
                      })}
                </p>
              </>
            ) : null}
          </Card>

          {/* Manual time adjustment: the stopwatch stands unless corrected. */}
          {phase === "feedback" && totalCooked > 0 ? (
            <div className="flex w-full flex-col items-center gap-2">
              {!adjustOpen ? (
                <>
                  <Button variant="ghost" onClick={() => {
                    setAdjustDraft(String(Math.round(adjustedTotal ?? totalCooked)));
                    setAdjustOpen(true);
                  }}>
                    {t("cook.adjustTime")}
                  </Button>
                  {adjustedTotal != null ? (
                    <p className="text-[12.5px] font-semibold text-muted">
                      {t("cook.adjustedNote", {
                        measured: fmtMin(measuredTotal),
                        adjusted: fmtMin(adjustedTotal),
                      })}
                    </p>
                  ) : null}
                </>
              ) : (
                <Card className="w-full border-orange-soft px-6 py-5">
                  <p className="text-center text-[13.5px] leading-relaxed text-muted">
                    {t("cook.adjustHint")}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      aria-label={t("cook.adjustMinus")}
                      onClick={() =>
                        setAdjustDraft((d) =>
                          String(Math.max(0, (parseInt(d, 10) || 0) - 1)),
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-deep text-orange-deep"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M5 12h14" /></svg>
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={adjustDraft}
                      onChange={(e) =>
                        setAdjustDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))
                      }
                      aria-label={t("cook.adjustTime")}
                      className="w-24 rounded-md border border-hair bg-cream-deep px-3 py-2 text-center font-display text-2xl font-extrabold tabular-nums text-ink"
                    />
                    <span className="font-body text-[15px] font-bold text-muted">
                      {t("common.min")}
                    </span>
                    <button
                      type="button"
                      aria-label={t("cook.adjustPlus")}
                      onClick={() =>
                        setAdjustDraft((d) =>
                          String(Math.min(1440, (parseInt(d, 10) || 0) + 1)),
                        )
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-cream-deep text-orange-deep"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                  </div>
                  <div className="mt-4 flex justify-center gap-2.5">
                    <Button variant="ghost" onClick={() => setAdjustOpen(false)}>
                      {t("common.cancel")}
                    </Button>
                    <Button
                      onClick={() => {
                        const parsed = parseInt(adjustDraft, 10);
                        setAdjustedTotal(
                          Number.isFinite(parsed)
                            ? Math.min(1440, Math.max(0, parsed))
                            : null,
                        );
                        setAdjustOpen(false);
                      }}
                    >
                      {t("cook.adjustUse")}
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          ) : null}

          {phase !== "done" ? (
            <>
              <h2 className="mt-2 text-center font-body text-[17px] font-bold text-ink">
                {t("cook.feedbackPrompt")}
              </h2>
              <div className="flex w-full flex-col gap-3">
                {feedbackOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSubmit(option.value)}
                    className={cn(
                      "w-full rounded-card border border-hair bg-white px-5 py-4 text-start shadow-[var(--shadow-card)] transition-colors hover:border-orange",
                      submitting && "pointer-events-none opacity-60",
                    )}
                  >
                    <span className="flex w-full items-center gap-4">
                      <span className="flex-1">
                        <span className="block font-body text-[15.5px] font-bold text-ink">
                          {option.title}
                        </span>
                        <span className="mt-0.5 block text-[13px] text-muted">
                          {option.subtitle}
                        </span>
                      </span>
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0 text-faint rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
              {submitting ? (
                <p className="flex items-center gap-2 text-[14px] font-semibold text-muted">
                  {t("cook.saving")}
                </p>
              ) : (
                <Button variant="ghost" onClick={() => void handleSubmit(null)}>
                  {t("cook.skip")}
                </Button>
              )}
            </>
          ) : (
            <div className="flex w-full flex-col items-center gap-4">
              {submitMsgKind === "error" ? (
                <p className="text-center text-[15px] font-bold text-orange-deep">
                  {t("cook.saveFailed")}
                </p>
              ) : submitMsgKind === "needsAuth" ? (
                <>
                  <p className="text-center text-[14.5px] leading-relaxed text-muted">
                    {t("cook.savedSignedOut")}
                  </p>
                  <Link
                    to={`/login?returnTo=${encodeURIComponent(`/recipe/${recipe.id}`)}`}
                    className="w-full"
                  >
                    <Button className="w-full">{t("cook.signInToSave")}</Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-center text-[15px] font-bold text-ink">
                    {t("cook.saved")}
                  </p>
                  <p className="text-center text-[13px] leading-relaxed text-muted">
                    {t("cook.pacePending")}
                  </p>
                </>
              )}
              <Button variant="ghost" onClick={leave} className="w-full">
                {t("cook.done")}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Render: cooking phase ---------------------------------------------------
  const step = steps[currentIndex];
  const alarmMinutes = step.literal_minutes ?? null;
  const alarmArmedHere = armedStep != null && armedStep === step.step_number;
  const onLastStep = currentIndex === steps.length - 1;
  const upcomingStep = onLastStep ? null : steps[currentIndex + 1];

  // Expected duration for THIS step, pace-calibrated when the signed-in cook
  // has a multiplier for its type (mobile uses the raw estimate; the brief
  // asks the web to surface calibrated times — publisher estimate otherwise).
  const baseExpectedMin = estimateStepMinutes(step, recipe, steps);
  const paceMult = paceMap.get(step.step_type) ?? null;
  const calibrated = paceMult != null && paceMult !== 1;
  const expectedMin =
    paceMult != null && paceMult !== 1
      ? Math.max(1, Math.round(baseExpectedMin * paceMult))
      : baseExpectedMin;
  const stepExpectedMs = expectedMin > 0 ? expectedMin * 60_000 : null;
  const timerColor =
    status === "running"
      ? "text-ink"
      : status === "paused"
        ? "text-muted"
        : "text-faint";

  const statusHint =
    status === "running"
      ? t("cook.hintRunning")
      : status === "paused"
        ? t("cook.hintPaused")
        : t("cook.hintIdle");

  const remainingSteps = Math.max(0, steps.length - 1 - currentIndex);
  const finishModalMessage =
    remainingSteps === 0
      ? t("cook.finishMessage")
      : remainingSteps === 1
        ? t("cook.finishRemainingOne")
        : t("cook.finishRemainingMany", { n: remainingSteps });

  // Visited (entered post-Start) steps render as filled dots.
  const doneFlags = steps.map(
    (s, i) => i !== currentIndex && stepMarks[s.step_number] != null,
  );

  const recipeHref = `/recipe/${recipe.id}`;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-cream"
      role="dialog"
      aria-modal="true"
      aria-label={t("cook.pageTitle")}
    >
      {/* Header — close ✕ + "STEP x / y" only: the step is the focus. */}
      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 pt-5">
        <button
          type="button"
          onClick={requestClose}
          aria-label={t("cook.closeA11y")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-pill bg-cream-deep text-muted transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
        <p className="flex-1 text-center text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">
          {t("cook.stepOf", { current: currentIndex + 1, total: steps.length })}
        </p>
        <span className="w-10 shrink-0" aria-hidden="true" />
      </div>

      {/* Step dots */}
      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 px-5 pt-4">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goToStep(i)}
            aria-label={t("cook.stepOf", { current: i + 1, total: steps.length })}
            aria-current={i === currentIndex}
            className={cn(
              "h-2.5 rounded-pill transition-all",
              i === currentIndex
                ? "w-7 bg-orange"
                : doneFlags[i]
                  ? "w-2.5 bg-orange/60 hover:bg-orange"
                  : "w-2.5 bg-hair hover:bg-faint",
            )}
          />
        ))}
      </div>

      {/* Single-step body */}
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 overflow-y-auto px-5 py-6">
        {/* meta row: step type + alarm chip + large text */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span
            className={cn(
              "rounded-pill px-3 py-1 text-[12px] font-bold",
              step.step_type === "passive"
                ? "bg-cream-deep text-muted"
                : step.step_type === "cleanup"
                  ? "bg-cream-deep text-muted"
                  : "bg-orange-soft text-orange-deep",
            )}
          >
            {stepTypeLabel(t, step.step_type)}
          </span>
          {alarmMinutes != null && alarmMinutes > 0 ? (
            <button
              type="button"
              onClick={onAlarmChipPress}
              aria-pressed={alarmArmedHere}
              aria-label={
                alarmArmedHere
                  ? `${t("cook.alarmArmed")} · ${t("cook.alarmCancel")}`
                  : t("cook.alarmSet", { minutes: Math.round(alarmMinutes) })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-bold transition-colors",
                alarmArmedHere
                  ? "bg-orange text-white hover:bg-orange-deep"
                  : "border border-hair bg-white text-orange-deep hover:border-orange",
              )}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5M9 2h6" />
              </svg>
              {alarmArmedHere
                ? `${t("cook.alarmArmed")} · ${t("cook.alarmCancel")}`
                : t("cook.alarmSet", { minutes: Math.round(alarmMinutes) })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleLargeText}
            aria-pressed={largeText}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12px] font-bold transition-colors",
              largeText
                ? "bg-orange-soft text-orange-deep"
                : "border border-hair bg-white text-muted hover:text-ink",
            )}
          >
            {largeText ? t("cook.largeTextOn") : t("cook.largeText")}
          </button>
        </div>

        {alarmFiredStep === step.step_number ? (
          <p className="rounded-pill bg-orange px-4 py-1.5 text-[13px] font-bold text-white">
            {t("cook.alarmFiredBody", {
              n: step.step_number,
              minutes: Math.round(alarmMinutes ?? 0),
            })}
          </p>
        ) : null}

        {showTabNotice ? (
          <p
            role="status"
            className="rounded-pill border border-hair bg-white px-4 py-1.5 text-[12.5px] font-semibold text-muted"
          >
            {t("cook.tabHiddenNotice")}
          </p>
        ) : null}

        {/* Pace nudge: a calibrated cook sees their multiplier for THIS step
            type; anonymous visitors get a quiet sign-in hint (publisher
            estimates stay in use either way). */}
        {calibrated && paceMult != null ? (
          <p className="text-[12.5px] font-bold text-teal">
            {t("pace.youUsually", { x: paceMult.toFixed(1) })}
          </p>
        ) : !authed ? (
          <Link
            to="/login"
            className="text-[12px] font-semibold text-muted underline decoration-hair underline-offset-4 hover:text-ink"
          >
            {t("pace.signInPrompt")}
          </Link>
        ) : null}

        {/* The stopwatch. */}
        <CookElapsedTimer
          cookStartAt={cookStartAt}
          pausedAt={pausedAt}
          pausedMsTotal={pausedMsTotal}
          running={status === "running"}
          className={cn(
            "font-display text-6xl font-extrabold md:text-7xl",
            timerColor,
          )}
        />
        <p
          className={cn(
            "text-[13px] font-semibold",
            step.step_type === "passive" && status === "running"
              ? "text-ink"
              : "text-muted",
          )}
        >
          {step.step_type === "passive" && status === "running"
            ? t("cook.hintHandsOff")
            : statusHint}
        </p>

        {/* Step pace bar — the honest-time glance (teal = measured). */}
        {stepExpectedMs != null && status !== "idle" ? (
          <CookStepPaceBar
            running={status === "running"}
            cookStartAt={cookStartAt}
            pausedAt={pausedAt}
            stepNumber={step.step_number}
            stepVisitElapsedMs={stepVisitElapsedMs}
            expectedMs={stepExpectedMs}
            expectedLabel={
              calibrated
                ? t("cook.stepExpectedForYou", { n: expectedMin })
                : t("cook.stepExpected", { n: expectedMin })
            }
            className="max-w-md"
          />
        ) : null}

        {/* The step itself. Large-text mode makes the card itself the
            next-step affordance (one tap anywhere). */}
        <Card className="w-full px-6 py-6">
          <div
            {...(largeText && status === "running" && !onLastStep
              ? {
                  role: "button",
                  tabIndex: 0,
                  onClick: nextStep,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      nextStep();
                    }
                  },
                }
              : {})}
          >
            <p
              className={cn(
                "leading-relaxed text-ink",
                largeText ? "text-[23px] leading-[1.45]" : "text-[17px]",
              )}
            >
              {lr.stepDescription(step)}
            </p>
            {largeText && status === "running" && !onLastStep ? (
              <p className="mt-4 text-[12.5px] text-faint">
                {t("cook.tapCardNext")}
              </p>
            ) : null}
          </div>
        </Card>

        {/* Next-step preview. */}
        {upcomingStep != null ? (
          <div className="w-full">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-faint">
              {t("cook.nextStep")}
            </p>
            <p className="mt-1 line-clamp-2 text-[14px] leading-relaxed text-muted">
              {lr.stepDescription(upcomingStep)}
            </p>
          </div>
        ) : null}
      </div>

      {/* Footer — one primary control per state. */}
      <div className="border-t border-hair bg-white/95 backdrop-blur">
        <div className="mx-auto w-full max-w-2xl px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {status === "idle" ? (
            <Button onClick={startCooking} className="w-full py-4 text-[16px]">
              {t("cook.startCooking")}
            </Button>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <CircleButton
                  label={t("cook.previous")}
                  onClick={prevStep}
                  disabled={currentIndex === 0}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </CircleButton>
                <div className="min-w-0 flex-1">
                  <Button
                    onClick={togglePauseResume}
                    variant={status === "running" ? "ghost" : "primary"}
                    className="w-full py-3.5"
                  >
                    {status === "running"
                      ? t("cook.pauseCooking")
                      : t("cook.resumeCooking")}
                  </Button>
                </div>
                {onLastStep ? (
                  <CircleButton
                    label={t("cook.finishCooking")}
                    onClick={() => setConfirmFinish(true)}
                    filled
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 13 4 4L19 7" />
                    </svg>
                  </CircleButton>
                ) : (
                  <CircleButton label={t("cook.next")} onClick={nextStep}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </CircleButton>
                )}
              </div>
              {!onLastStep ? (
                <button
                  type="button"
                  onClick={() => setConfirmFinish(true)}
                  className="mt-2 w-full rounded-pill py-2 font-body text-[14px] font-bold text-muted transition-colors hover:text-ink"
                >
                  {t("cook.finishCooking")}
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Finish confirmation — never end an active cook on a stray tap. */}
      {confirmFinish ? (
        <ConfirmCard
          title={t("cook.finishTitle")}
          message={finishModalMessage}
          confirmLabel={t("cook.finishLogTime")}
          cancelLabel={t("cook.keepCooking")}
          onConfirm={() => {
            setConfirmFinish(false);
            finishCooking();
          }}
          onCancel={() => setConfirmFinish(false)}
        />
      ) : null}

      {/* Discard confirmation (✕ / Escape on an active session). */}
      {confirmDiscard ? (
        <ConfirmCard
          title={t("cook.discardTitle")}
          message={t("cook.discardMessage")}
          confirmLabel={t("cook.discardExitBtn")}
          cancelLabel={t("cook.keepCooking")}
          onConfirm={() => {
            setConfirmDiscard(false);
            navigate(recipeHref, { replace: true });
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      ) : null}
    </div>
  );
}
