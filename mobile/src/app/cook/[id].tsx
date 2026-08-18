import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  cancelStepAlarm,
  initCookEventHandlers,
  requestAlarmPermission,
  scheduleStepAlarm,
  startCookNotification,
  stopCookNotification,
} from "@/utils/cookAlarms";

import { getRecipe, submitCookSession } from "@/api/client";
import { track } from "@/analytics";
import {
  flushPendingCookSessions,
  getCachedRecipe,
  getPendingCookSessionCount,
  upsertRecipes,
} from "@/db/database";
import { Button, Badge, Chip, Card, IconPressable, StepDots } from "@/components/ui";
import {
  useFmtMinutes,
  useLocalizedRecipe,
  useT,
  stepTypeLabel,
} from "@/i18n";
import { Radius, Shadow, Space, Type, useThemeColors } from "@/theme";
import type {
  CookSessionPayload,
  Feedback,
  Recipe,
  RecipeStep,
} from "@/types";

type LoadState = "loading" | "ready" | "error";
type Phase = "cooking" | "feedback" | "submitting" | "done";
/** Whole-recipe stopwatch state (replaces the old per-step timers). */
type CookStatus = "idle" | "running" | "paused" | "finished";

const TICK_MS = 250;

/** Format an elapsed duration (ms) as `M:SS`. */
function formatMSS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Round to 2 decimals (matches the submission spec). */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Generate a UUID v4. Uses the native Web Crypto API when available, falling
 * back to a small RFC-4122 v4 helper for older runtimes. Used to produce a
 * stable idempotency key per cook session so offline retries don't create
 * duplicate submissions server-side.
 */
function makeId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  // Fallback: RFC-4122 v4 via getrandom-style Math.random (non-crypto-grade,
  // but adequate for client-side idempotency dedupe).
  const rnd = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${
    ((Math.random() * 0x4) | 0x8).toString(16)
  }${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}

// ---- Whole-recipe stopwatch math ---------------------------------------------

/** One closed pause interval of the stopwatch, in wall-clock epoch ms. */
interface PauseInterval {
  from: number;
  to: number;
}

/**
 * Pause-adjusted duration of the wall-clock segment [from, to]: its raw
 * length minus any pause time overlapping it. This is the single place
 * pause time is subtracted, shared by the live display and the per-step
 * durations built at finish.
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

export default function CookModeScreen() {
  // Keep the screen on for the entire cook.
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const fmtMin = useFmtMinutes();
  const lr = useLocalizedRecipe();

  // Theme-aware styles: rebuilt only when the resolved palette changes.
  const styles = useMemo(
    () =>
      StyleSheet.create({
        fullScreen: {
          flex: 1,
          backgroundColor: colors.canvas,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingHorizontal: Space.xxl,
        },
        muted: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
          marginBottom: Space.xs,
        },
        retryBtn: {
          marginTop: Space.md,
        },
        // Header
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: Space.lg,
          paddingVertical: Space.md,
          gap: Space.md,
        },
        closeGlyph: {
          ...Type.title,
          fontSize: 18,
          color: colors.inkSecondary,
        },
        overline: {
          ...Type.overline,
          color: colors.inkSecondary,
          textTransform: "uppercase",
          // Sole text in the header row (the recipe title was removed): take
          // the remaining width and center "STEP x / y" between the close
          // button and the far edge.
          flex: 1,
          textAlign: "center",
        },
        // Dots
        dotsRow: {
          paddingHorizontal: Space.lg,
          paddingBottom: Space.sm,
        },
        // Step body
        stepBody: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Space.xl,
          paddingVertical: Space.lg,
          gap: Space.lg,
        },
        stepMetaRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
        },
        timer: {
          ...Type.timer,
        },
        statusHint: {
          ...Type.caption,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        descCard: {
          width: "100%",
        },
        stepDescription: {
          ...Type.body,
          fontSize: 17,
          lineHeight: 24,
          color: colors.ink,
          // Default "auto" alignment follows the layout direction.
          textAlign: "auto",
        },
        // Footer
        footer: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingTop: Space.lg,
          gap: Space.sm,
          ...Shadow.floating,
        },
        // Pause/Resume (primary) + Finish (secondary) share one row while a
        // cook is active. Flex lives on the wrapper View (never on the
        // Pressable itself) — Android paint-collapse quirk.
        controlRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        primaryBtn: {
          flex: 1,
        },
        navRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
        },
        navNextBtn: {
          flex: 1,
          flexDirection: "column",
        },
        // Feedback phase
        feedbackWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Space.xxl,
          gap: Space.md,
        },
        feedbackTitle: {
          ...Type.h1,
          color: colors.ink,
          textAlign: "center",
        },
        feedbackStatsRow: {
          flexDirection: "row",
          alignItems: "stretch",
          justifyContent: "center",
          gap: Space.sm,
          marginTop: Space.xs,
        },
        totalPill: {
          borderRadius: Radius.lg,
          paddingVertical: Space.md,
          paddingHorizontal: Space.xl,
          alignItems: "center",
          minWidth: 120,
        },
        totalPillValue: {
          ...Type.h2,
          fontWeight: "800",
        },
        totalPillLabel: {
          ...Type.caption,
          color: colors.inkFaint,
          marginTop: Space.xs,
          textTransform: "uppercase",
        },
        cleanupEstimate: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "500",
        },
        feedbackPrompt: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
          marginTop: Space.sm,
        },
        feedbackButtons: {
          width: "100%",
          gap: Space.sm,
          marginTop: Space.sm,
        },
        feedbackCard: {
          width: "100%",
          alignItems: "center",
        },
        feedbackCardText: {
          ...Type.h3,
          fontWeight: "700",
        },
        submittingRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          marginTop: Space.sm,
        },
        // Done
        doneWrap: {
          width: "100%",
          alignItems: "center",
          gap: Space.lg,
          marginTop: Space.md,
        },
        savedMsg: {
          ...Type.body,
          fontWeight: "600",
          textAlign: "center",
        },
      }),
    [colors],
  );

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- Whole-recipe stopwatch ------------------------------------------------
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Wall-clock instant the cook started; null until Start is pressed. */
  const [cookStartAt, setCookStartAt] = useState<number | null>(null);
  /** Total ms spent paused across all completed pause intervals. */
  const [pausedMsTotal, setPausedMsTotal] = useState(0);
  /** Set while paused (the instant the pause began); null while running. */
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<CookStatus>("idle");
  /** Re-render tick: only updated while running, to drive the live display. */
  const [now, setNow] = useState(Date.now());

  /** Pause log (closed intervals) — subtracted from each step's segment. */
  const pausesRef = useRef<PauseInterval[]>([]);
  /**
   * Wall-clock instant each step was FIRST entered (keyed by step_number).
   * Recorded on initial start and on every Next/Prev/jump once the cook has
   * started; converted to pause-adjusted elapsed via adjust() at finish.
   * Steps never entered have no mark and submit 0 minutes.
   */
  const stepMarksRef = useRef<Record<number, number>>({});

  /** Armed step alarm: id in a ref (event handlers), step number for render. */
  const armedAlarmIdRef = useRef<string | null>(null);
  const [armedStep, setArmedStep] = useState<number | null>(null);

  // Stable per-session idempotency key (generated on first submission) so
  // retried/offline-replayed POSTs don't create duplicate cook sessions.
  const idempotencyKey = useRef<string>("");

  const [phase, setPhase] = useState<Phase>("cooking");
  const [summary, setSummary] = useState<CookSummary | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  // Whether submitMsg is an ERROR message (drives the done-screen color; the
  // old `startsWith("Could not")` check doesn't survive translation).
  const [submitFailed, setSubmitFailed] = useState(false);

  const steps: RecipeStep[] = useMemo(
    () => recipe?.recipe_steps ?? [],
    [recipe],
  );

  // ---- Load recipe ---------------------------------------------------------
  const loadRecipe = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const numericId = Number(id);
      let result = await getCachedRecipe(numericId);
      if (!result || (result.recipe_steps?.length ?? 0) === 0) {
        // Cache miss OR cached copy lost its steps (damaged cache): fetch
        // live and re-cache so the step library self-heals recipe by recipe.
        try {
          const fetched = await getRecipe(id);
          if (fetched.recipe_steps?.length) {
            upsertRecipes([fetched], { withSteps: true }).catch(() => {});
            result = fetched;
          }
        } catch {
          // Network failed (offline / 402): fall back to whatever is cached.
        }
      }
      setRecipe(result);
      setLoadState("ready");
    } catch (error) {
      console.warn("[RecipeReal] cook loadRecipe failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : t("common.loadFailedRecipe"),
      );
      setLoadState("error");
    }
  }, [id, t]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // Fire-and-forget analytics: cook started once steps are present (once).
  const startedTrackedRef = useRef(false);
  useEffect(() => {
    if (steps.length > 0 && recipe?.id != null && !startedTrackedRef.current) {
      startedTrackedRef.current = true;
      track("cook_started", {
        recipe_id: recipe.id,
        step_count: steps.length,
      });
    }
  }, [steps, recipe]);

  // ---- Pause-adjusted elapsed (derived from timestamps) ---------------------
  // Deriving the display from cookStartAt/pausedAt/pausedMsTotal means the
  // correct elapsed reappears after ANY amount of backgrounded time: the
  // wall clock kept running and pauses are explicit intervals.
  const elapsedMs = useMemo(() => {
    if (cookStartAt == null) return 0;
    // While paused the display freezes at the pause instant.
    const end = pausedAt ?? now;
    return Math.max(0, end - cookStartAt - pausedMsTotal);
  }, [cookStartAt, pausedAt, pausedMsTotal, now]);

  // ---- Live ticking --------------------------------------------------------
  // Only tick while the stopwatch is actively running.
  useEffect(() => {
    if (phase !== "cooking" || status !== "running") return;
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, [phase, status]);

  // ---- Step alarms (notifee; no-op in Expo Go) ------------------------------

  /** Cancel the armed step alarm, if any. Idempotent; never throws. */
  const clearArmedAlarm = useCallback(async () => {
    const alarmId = armedAlarmIdRef.current;
    armedAlarmIdRef.current = null;
    setArmedStep(null);
    await cancelStepAlarm(alarmId);
  }, []);

  /** Arm (or cancel, when already armed) the alarm for the current step. */
  const onAlarmChipPress = useCallback(async () => {
    const step = steps[currentIndex];
    const minutes = step?.literal_minutes;
    if (!recipe || !step || typeof minutes !== "number" || minutes <= 0) {
      return;
    }
    // One armed alarm at a time: tapping the armed chip cancels it; tapping
    // elsewhere replaces the previous one.
    if (armedStep === step.step_number) {
      await clearArmedAlarm();
      return;
    }
    await clearArmedAlarm();
    if (!(await requestAlarmPermission())) return;
    const alarmId = await scheduleStepAlarm({
      recipeTitle: lr.title(recipe),
      stepNumber: step.step_number,
      minutes,
      t,
    });
    if (!alarmId) return;
    armedAlarmIdRef.current = alarmId;
    setArmedStep(step.step_number);
    track("alarm_armed", {
      recipe_id: recipe.id,
      step_number: step.step_number,
      minutes,
    });
  }, [steps, currentIndex, recipe, armedStep, clearArmedAlarm, lr, t]);

  // ---- Stopwatch actions -----------------------------------------------------

  /** Record the entry mark for step `i` (first entry only, post-Start). */
  const recordMark = useCallback(
    (i: number) => {
      if (cookStartAt == null) return;
      const stepNumber = steps[i]?.step_number;
      if (stepNumber == null) return;
      if (stepMarksRef.current[stepNumber] == null) {
        stepMarksRef.current[stepNumber] = Date.now();
      }
    },
    [cookStartAt, steps],
  );

  const startCooking = useCallback(() => {
    if (!recipe || cookStartAt != null) return;
    const at = Date.now();
    setCookStartAt(at);
    setPausedMsTotal(0);
    setPausedAt(null);
    setStatus("running");
    setNow(at);
    recordMark(currentIndex);
    // Persistent Android notification with the ticking chronometer (no-op
    // in Expo Go / iOS — the in-app stopwatch is unaffected).
    void startCookNotification({
      recipeTitle: lr.title(recipe),
      recipeId: recipe.id,
      startedAt: at,
      pausedMs: 0,
      paused: false,
      t,
    });
  }, [recipe, cookStartAt, currentIndex, recordMark, lr, t]);

  /** The single Pause/Resume control (button + notification quick action). */
  const togglePauseResume = useCallback(() => {
    if (!recipe || cookStartAt == null) return;
    if (status === "running") {
      const at = Date.now();
      setPausedAt(at);
      setStatus("paused");
      // pausedMs is unchanged at the pause instant; the re-post flips the
      // quick action to Resume and re-bases the chronometer.
      void startCookNotification({
        recipeTitle: lr.title(recipe),
        recipeId: recipe.id,
        startedAt: cookStartAt,
        pausedMs: pausedMsTotal,
        paused: true,
        t,
      });
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
      setNow(at);
      void startCookNotification({
        recipeTitle: lr.title(recipe),
        recipeId: recipe.id,
        startedAt: cookStartAt,
        pausedMs: newTotal,
        paused: false,
        t,
      });
    }
  }, [recipe, cookStartAt, status, pausedAt, pausedMsTotal, lr, t]);

  /**
   * Finish the cook: freeze the stopwatch, derive per-step durations from
   * the entry marks (mark[next] - mark[this], pause-adjusted via adjust();
   * the last step ends at the finish elapsed; unvisited steps submit 0) and
   * move to the feedback phase. Same handler for the Finish button, Next on
   * the last step, and the notification quick action.
   */
  const finishCooking = useCallback(() => {
    if (!recipe || phase !== "cooking") return;
    const startAt = cookStartAt;
    const endWall = pausedAt ?? Date.now();
    const pauses = pausesRef.current;
    let built: CookSummary;
    if (startAt == null) {
      // Never started: everything submits as 0 (same as idle steps before).
      built = {
        perStep: steps.map((step) => ({ step, actual_minutes: 0 })),
        cleanup_minutes: null,
        total_actual_minutes: 0,
      };
    } else {
      const marks = stepMarksRef.current;
      const finishElapsed = adjust(startAt, endWall, pauses);
      const perStep = steps.map((step, i) => {
        const startWall = marks[step.step_number];
        if (startWall == null) return { step, actual_minutes: 0 };
        const startAdj = adjust(startAt, startWall, pauses);
        const nextWall =
          i + 1 < steps.length ? marks[steps[i + 1].step_number] : undefined;
        const endAdj =
          nextWall != null ? adjust(startAt, nextWall, pauses) : finishElapsed;
        return {
          step,
          actual_minutes: round2(Math.max(0, endAdj - startAdj) / 60000),
        };
      });
      const cleanupSum =
        perStep
          .filter((p) => p.step.step_type === "cleanup")
          .reduce((sum, p) => sum + p.actual_minutes, 0) || null;
      const nonCleanup =
        perStep.filter((p) => p.step.step_type !== "cleanup").length > 0;
      built = {
        perStep,
        cleanup_minutes: cleanupSum,
        total_actual_minutes: round2(
          perStep
            .filter((p) => (nonCleanup ? p.step.step_type !== "cleanup" : true))
            .reduce((sum, p) => sum + p.actual_minutes, 0),
        ),
      };
    }
    setStatus("finished");
    setSummary(built);
    setPhase("feedback");
    track("cook_finished", {
      recipe_id: recipe.id,
      total_actual_minutes: built.total_actual_minutes,
    });
    void clearArmedAlarm();
    void stopCookNotification();
  }, [recipe, phase, cookStartAt, pausedAt, steps, clearArmedAlarm]);

  // ---- Notification quick actions -> same handlers as the buttons ----------
  // Latest-handler refs: the wiring effect runs once, the callbacks change.
  const togglePauseRef = useRef(togglePauseResume);
  const finishRef = useRef(finishCooking);
  togglePauseRef.current = togglePauseResume;
  finishRef.current = finishCooking;
  useEffect(() => {
    const unsubscribe = initCookEventHandlers({
      onPauseToggle: () => togglePauseRef.current(),
      onFinish: () => finishRef.current(),
    });
    return () => {
      unsubscribe();
      // Leaving Cook Mode entirely: drop the notification + armed alarm.
      void stopCookNotification();
      const alarmId = armedAlarmIdRef.current;
      armedAlarmIdRef.current = null;
      void cancelStepAlarm(alarmId);
    };
  }, []);

  // ---- Step navigation -------------------------------------------------------

  /** Enter step `i`: cancel the armed alarm and record its entry mark. */
  const goToStep = useCallback(
    (i: number) => {
      if (i === currentIndex) return;
      void clearArmedAlarm();
      setCurrentIndex(i);
      recordMark(i);
    },
    [currentIndex, clearArmedAlarm, recordMark],
  );

  const nextStep = useCallback(() => {
    if (currentIndex < steps.length - 1) {
      goToStep(currentIndex + 1);
    } else {
      finishCooking();
    }
  }, [currentIndex, steps.length, goToStep, finishCooking]);

  const prevStep = useCallback(() => {
    goToStep(Math.max(0, currentIndex - 1));
  }, [goToStep, currentIndex]);

  // Recipe cleanup estimate shown as context on the feedback phase.
  const cleanupEstimate =
    recipe?.cleanup_estimate_minutes ?? recipe?.cleanup_avg_minutes ?? null;

  const handleSubmit = useCallback(
    async (feedback: Feedback | null) => {
      if (!recipe || !summary) return;
      // Fire-and-forget analytics when a feedback button is chosen or skipped.
      track("cook_completed", {
        recipe_id: recipe.id,
        total_actual_minutes: summary.total_actual_minutes,
        feedback,
      });
      setPhase("submitting");
      setSubmitMsg(null);
      setSubmitFailed(false);
      // Lazily mint one idempotency key per cook session; it is stable across
      // retries (offline queue stores the whole payload as JSON, key included).
      if (!idempotencyKey.current) idempotencyKey.current = makeId();
      const payload: CookSessionPayload = {
        recipe_id: recipe.id,
        total_actual_minutes: summary.total_actual_minutes,
        cleanup_minutes: summary.cleanup_minutes,
        feedback,
        idempotency_key: idempotencyKey.current,
        timing_submissions: summary.perStep.map((p) => ({
          recipe_step_id: p.step.id,
          actual_minutes: p.actual_minutes,
        })),
      };
      let outcome: "saved" | "queued" | "error" = "saved";
      try {
        // Resolves on success OR when the payload was enqueued for offline
        // sync. To distinguish, check the pending count after the call: if it
        // grew, the payload was queued (offline path).
        const beforeCount = await getPendingCookSessionCount().catch(
          () => 0,
        );
        await submitCookSession(payload);
        const afterCount = await getPendingCookSessionCount().catch(
          () => beforeCount,
        );
        outcome = afterCount > beforeCount ? "queued" : "saved";
      } catch (error) {
        // Real server error — surface but still let the user finish.
        console.warn("[RecipeReal] submitCookSession failed:", error);
        outcome = "error";
      }
      // Best-effort background flush of any queued sessions.
      try {
        await flushPendingCookSessions();
      } catch (error) {
        // Non-fatal.
        console.warn("[RecipeReal] flushPendingCookSessions failed:", error);
      }
      setSubmitMsg(
        outcome === "error"
          ? t("cook.saveFailed")
          : outcome === "queued"
            ? t("cook.savedQueued")
            : t("cook.saved"),
      );
      setSubmitFailed(outcome === "error");
      setPhase("done");
    },
    [recipe, summary, t],
  );

  const finish = useCallback(() => {
    router.push(`/recipe/${id}`);
  }, [id]);

  // ---- Render --------------------------------------------------------------
  if (loadState === "loading") {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>{t("common.loadingRecipe")}</Text>
        </View>
      </View>
    );
  }

  if (loadState === "error" || !recipe) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t("common.somethingWentWrong")}</Text>
          <Text style={styles.muted}>
            {errorMessage ?? t("common.couldNotLoadRecipe")}
          </Text>
          <Button
            title={t("common.retry")}
            onPress={loadRecipe}
            style={styles.retryBtn}
          />
        </View>
      </View>
    );
  }

  if (steps.length === 0) {
    return (
      <View style={[styles.fullScreen, { paddingTop: insets.top + Space.md }]}>
        <View style={styles.headerRow}>
          <IconPressable onPress={() => router.back()} hitSlop={Space.md}>
            <Text style={styles.closeGlyph}>✕</Text>
          </IconPressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>{t("cook.noSteps")}</Text>
        </View>
      </View>
    );
  }

  // ---- Feedback / submitting / done phases ----
  if (phase === "feedback" || phase === "submitting" || phase === "done") {
    const submitting = phase === "submitting";
    const totalCooked = summary?.total_actual_minutes ?? 0;
    const cleanupMinutes = summary?.cleanup_minutes ?? null;
    return (
      <View
        style={[
          styles.fullScreen,
          {
            paddingTop: insets.top + Space.md,
            paddingBottom: insets.bottom + Space.md,
          },
        ]}
      >
        <View style={styles.feedbackWrap}>
          <Text style={styles.feedbackTitle}>{t("cook.youCooked")}</Text>

          <View style={styles.feedbackStatsRow}>
            <View
              style={[
                styles.totalPill,
                { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={[styles.totalPillValue, { color: colors.accent }]}>
                {fmtMin(totalCooked)}
              </Text>
              <Text style={styles.totalPillLabel}>
                {t("cook.totalCooked")}
              </Text>
            </View>
            {cleanupMinutes != null ? (
              <View
                style={[
                  styles.totalPill,
                  { backgroundColor: colors.surfaceSoft },
                ]}
              >
                <Text
                  style={[styles.totalPillValue, { color: colors.inkSecondary }]}
                >
                  {fmtMin(cleanupMinutes)}
                </Text>
                <Text style={styles.totalPillLabel}>
                  {t("common.cleanup")}
                </Text>
              </View>
            ) : null}
          </View>

          {cleanupEstimate != null ? (
            <Text style={styles.cleanupEstimate}>
              {t("cook.cleanupEstimate", { n: Math.round(cleanupEstimate) })}
            </Text>
          ) : null}

          {phase !== "done" ? (
            <>
              <Text style={styles.feedbackPrompt}>
                {t("cook.feedbackPrompt")}
              </Text>
              <View style={styles.feedbackButtons}>
                <Card
                  onPress={submitting ? undefined : () => handleSubmit("faster")}
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: colors.successSoft },
                  ]}
                >
                  <Text style={[styles.feedbackCardText, { color: colors.success }]}>
                    {t("cook.faster")}
                  </Text>
                </Card>
                <Card
                  onPress={
                    submitting ? undefined : () => handleSubmit("as_expected")
                  }
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: colors.amberSoft },
                  ]}
                >
                  <Text
                    style={[
                      styles.feedbackCardText,
                      // Step-tone amber fg: #8A5A12 on light, warm on dark.
                      { color: colors.stepTones.active.fg },
                    ]}
                  >
                    {t("cook.asExpected")}
                  </Text>
                </Card>
                <Card
                  onPress={submitting ? undefined : () => handleSubmit("slower")}
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: colors.dangerSoft },
                  ]}
                >
                  <Text style={[styles.feedbackCardText, { color: colors.danger }]}>
                    {t("cook.slower")}
                  </Text>
                </Card>
              </View>
            </>
          ) : (
            <View style={styles.doneWrap}>
              {submitMsg ? (
                <Text
                  style={[
                    styles.savedMsg,
                    submitFailed
                      ? { color: colors.danger }
                      : { color: colors.success },
                  ]}
                >
                  {submitMsg}
                </Text>
              ) : null}
              <Button
                title={t("cook.done")}
                onPress={finish}
                fullWidth
                size="lg"
              />
            </View>
          )}

          {submitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator color={colors.accent} size="small" />
              <Text style={styles.muted}>{t("cook.saving")}</Text>
            </View>
          ) : phase !== "done" ? (
            <Button
              title={t("cook.skip")}
              variant="ghost"
              onPress={() => handleSubmit(null)}
            />
          ) : null}
        </View>
      </View>
    );
  }

  // ---- Cooking phase ----
  const step = steps[currentIndex];
  const alarmMinutes = step.literal_minutes ?? null;
  const alarmArmedHere = armedStep != null && armedStep === step.step_number;

  const timerColor =
    status === "running"
      ? colors.ink
      : status === "paused"
        ? colors.inkSecondary
        : colors.inkFaint;

  const statusHint =
    status === "running"
      ? t("cook.hintRunning")
      : status === "paused"
        ? t("cook.hintPaused")
        : t("cook.hintIdle");

  // Visited (entered post-Start) steps render as filled dots.
  const doneFlags = steps.map(
    (s, i) => i !== currentIndex && stepMarksRef.current[s.step_number] != null,
  );

  return (
    <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
      {/* Header — close ✕ + "STEP x / y" only (no recipe title: less on
          screen, the step is the focus). */}
      <View style={styles.headerRow}>
        <IconPressable onPress={() => router.back()} hitSlop={Space.md}>
          <Text style={styles.closeGlyph}>✕</Text>
        </IconPressable>
        <Text style={styles.overline}>
          {t("cook.stepOf", {
            current: currentIndex + 1,
            total: steps.length,
          })}
        </Text>
      </View>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        <StepDots
          count={steps.length}
          current={currentIndex}
          done={doneFlags}
          onJump={goToStep}
        />
      </View>

      {/* Single-step body (remounts on index change) */}
      <View key={currentIndex} style={styles.stepBody}>
        <View style={styles.stepMetaRow}>
          <Badge
            label={stepTypeLabel(t, step.step_type || "active")}
            stepType={step.step_type}
          />
          {/* Step alarm chip: only steps whose text states a time. */}
          {alarmMinutes != null && alarmMinutes > 0 ? (
            <IconPressable
              onPress={onAlarmChipPress}
              hitSlop={Space.xs}
              accessibilityLabel={t("cook.alarmChip", {
                minutes: Math.round(alarmMinutes),
              })}
            >
              <Chip
                tone={alarmArmedHere ? "accent" : "amber"}
                size="sm"
                label={
                  alarmArmedHere
                    ? `${t("cook.alarmArmed")} · ${t("cook.alarmCancel")}`
                    : t("cook.alarmChip", {
                        minutes: Math.round(alarmMinutes),
                      })
                }
              />
            </IconPressable>
          ) : null}
        </View>

        <Text style={[styles.timer, { color: timerColor }]}>
          {formatMSS(elapsedMs)}
        </Text>
        <Text style={styles.statusHint}>{statusHint}</Text>

        <Card style={styles.descCard} padding={Space.xl} shadow="card">
          <Text style={styles.stepDescription}>
            {lr.stepDescription(step)}
          </Text>
        </Card>
      </View>

      {/* Footer: stopwatch control + navigation row */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Space.sm,
            paddingHorizontal: Space.lg,
          },
        ]}
      >
        {status === "idle" ? (
          <Button
            title={t("cook.startCooking")}
            variant="primary"
            size="lg"
            fullWidth
            onPress={startCooking}
          />
        ) : (
          <View style={styles.controlRow}>
            {/* flex on the wrapper View (never on the Pressable itself) so
                the button stretches without the Android paint quirk. */}
            <View style={styles.primaryBtn}>
              <Button
                title={
                  status === "running"
                    ? t("cook.pauseCooking")
                    : t("cook.resumeCooking")
                }
                variant={status === "running" ? "secondary" : "primary"}
                size="lg"
                fullWidth
                onPress={togglePauseResume}
              />
            </View>
            <Button
              title={t("cook.finishCooking")}
              variant="ghost"
              size="lg"
              onPress={finishCooking}
            />
          </View>
        )}

        <View style={styles.navRow}>
          <Button
            title={t("cook.previous")}
            variant="ghost"
            size="md"
            disabled={currentIndex === 0}
            onPress={prevStep}
          />
          {/* flex on the wrapper View (never on the Pressable itself) so the
              button stretches without the Android paint-collapse quirk. */}
          <View style={styles.navNextBtn}>
            <Button
              title={
                currentIndex === steps.length - 1
                  ? t("cook.finishCooking")
                  : t("cook.next")
              }
              variant="primary"
              size="lg"
              fullWidth
              onPress={nextStep}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
