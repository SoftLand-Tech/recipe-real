import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getRecipe, submitCookSession } from "@/api/client";
import { track } from "@/analytics";
import {
  flushPendingCookSessions,
  getCachedRecipe,
  getPendingCookSessionCount,
  upsertRecipes,
} from "@/db/database";
import { Button, Badge, Chip, Card, StepDots, fmtMinutes } from "@/components/ui";
import { Color, Radius, Shadow, Space, Type } from "@/theme";
import type {
  CookSessionPayload,
  Feedback,
  Recipe,
  RecipeStep,
} from "@/types";

type LoadState = "loading" | "ready" | "error";
type Phase = "cooking" | "feedback" | "submitting" | "done";
type TimerState = "idle" | "running" | "paused" | "done";

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

export default function CookModeScreen() {
  // Keep the screen on for the entire cook.
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ---- Timer state ---------------------------------------------------------
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Accumulated paused/ms per step (excludes the live running segment). */
  const [elapsedMs, setElapsedMs] = useState<number[]>([]);
  /** Per-step timer state. The cook decides when to start each step. */
  const [timerState, setTimerState] = useState<TimerState[]>([]);
  /** Re-render tick: only updated while running, to drive the live display. */
  const [now, setNow] = useState(Date.now());

  const stepStartRef = useRef<number>(Date.now());
  // Stable per-session idempotency key (generated on first submission) so
  // retried/offline-replayed POSTs don't create duplicate cook sessions.
  const idempotencyKey = useRef<string>("");

  const [phase, setPhase] = useState<Phase>("cooking");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

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
        error instanceof Error ? error.message : "Failed to load recipe.",
      );
      setLoadState("error");
    }
  }, [id]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // Initialize the elapsed + timer-state arrays once steps are known.
  // Per the new interaction model, steps start IDLE — the cook starts the
  // timer when they begin each step.
  useEffect(() => {
    if (steps.length > 0 && elapsedMs.length === 0) {
      setElapsedMs(new Array(steps.length).fill(0));
      setTimerState(new Array(steps.length).fill("idle"));
      // Fire-and-forget analytics: cook started once steps are present.
      if (recipe?.id != null) {
        track("cook_started", {
          recipe_id: recipe.id,
          step_count: steps.length,
        });
      }
    }
  }, [steps, elapsedMs.length, recipe]);

  // ---- Live ticking --------------------------------------------------------
  // Only tick while the current step is actively running.
  useEffect(() => {
    if (phase !== "cooking" || timerState[currentIndex] !== "running") return;
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, [phase, timerState, currentIndex]);

  // ---- Timer actions -------------------------------------------------------
  /** Fold the current running segment into elapsedMs[currentIndex], then reset
   *  the baseline so the same segment can never be re-committed (e.g. when
   *  navigating away from and back to a running step). Computing the delta
   *  outside the state updater also avoids re-running it under StrictMode. */
  const commitLiveSegment = useCallback(() => {
    const delta = Date.now() - stepStartRef.current;
    stepStartRef.current = Date.now();
    if (delta <= 0) return;
    const i = currentIndex;
    setElapsedMs((prev) => {
      const next = [...prev];
      next[i] = (next[i] ?? 0) + delta;
      return next;
    });
  }, [currentIndex]);

  const startTimer = useCallback(
    (i: number) => {
      stepStartRef.current = Date.now();
      setNow(Date.now());
      setTimerState((s) => s.map((t, idx) => (idx === i ? "running" : t)));
    },
    [],
  );

  const pauseTimer = useCallback(
    (i: number) => {
      if (currentIndex === i) commitLiveSegment();
      setTimerState((s) => s.map((t, idx) => (idx === i ? "paused" : t)));
    },
    [commitLiveSegment, currentIndex],
  );

  const resumeTimer = useCallback(
    (i: number) => {
      stepStartRef.current = Date.now();
      setNow(Date.now());
      setTimerState((s) => s.map((t, idx) => (idx === i ? "running" : t)));
    },
    [],
  );

  /** "Next" = mark current step done + advance. The cook is in control. */
  const nextStep = useCallback(() => {
    if (timerState[currentIndex] === "running") commitLiveSegment();
    setTimerState((s) =>
      s.map((t, idx) => (idx === currentIndex ? "done" : t)),
    );
    if (currentIndex < steps.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setPhase("feedback");
    }
  }, [commitLiveSegment, currentIndex, steps.length, timerState]);

  const prevStep = useCallback(() => {
    if (timerState[currentIndex] === "running") {
      commitLiveSegment();
      // Pause the step we're leaving so its timer doesn't keep accruing while
      // we view another step; the cook resumes it explicitly on return.
      setTimerState((s) =>
        s.map((t, idx) => (idx === currentIndex ? "paused" : t)),
      );
    }
    setCurrentIndex(Math.max(0, currentIndex - 1));
  }, [commitLiveSegment, currentIndex, timerState]);

  const onJump = useCallback(
    (i: number) => {
      if (i === currentIndex) return;
      if (timerState[currentIndex] === "running") {
        commitLiveSegment();
        // Pause the running step we're leaving (see prevStep).
        setTimerState((s) =>
          s.map((t, idx) => (idx === currentIndex ? "paused" : t)),
        );
      }
      setCurrentIndex(i);
    },
    [commitLiveSegment, currentIndex, timerState],
  );

  // ---- Submission summary --------------------------------------------------
  const summary = useMemo(() => {
    const perStep = steps.map((s, i) => ({
      step: s,
      actual_minutes: round2((elapsedMs[i] ?? 0) / 60000),
    }));
    const cleanup_minutes =
      perStep
        .filter((p) => p.step.step_type === "cleanup")
        .reduce((sum, p) => sum + p.actual_minutes, 0) || null;
    const nonCleanup =
      perStep.filter((p) => p.step.step_type !== "cleanup").length > 0;
    const total_actual_minutes = round2(
      perStep
        .filter((p) => (nonCleanup ? p.step.step_type !== "cleanup" : true))
        .reduce((sum, p) => sum + p.actual_minutes, 0),
    );
    return { perStep, cleanup_minutes, total_actual_minutes };
  }, [steps, elapsedMs]);

  // Recipe cleanup estimate shown as context on the feedback phase.
  const cleanupEstimate =
    recipe?.cleanup_estimate_minutes ?? recipe?.cleanup_avg_minutes ?? null;

  const handleSubmit = useCallback(
    async (feedback: Feedback | null) => {
      if (!recipe) return;
      // Fire-and-forget analytics when a feedback button is chosen or skipped.
      track("cook_completed", {
        recipe_id: recipe.id,
        total_actual_minutes: summary.total_actual_minutes,
        feedback,
      });
      setPhase("submitting");
      setSubmitMsg(null);
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
          ? "Could not save. Please try again later."
          : outcome === "queued"
            ? "Saved — will sync when online."
            : "Saved.",
      );
      setPhase("done");
    },
    [recipe, summary],
  );

  const finish = useCallback(() => {
    router.push(`/recipe/${id}`);
  }, [id]);

  // ---- Render --------------------------------------------------------------
  if (loadState === "loading") {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Color.accent} />
          <Text style={styles.muted}>Loading recipe…</Text>
        </View>
      </View>
    );
  }

  if (loadState === "error" || !recipe) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.muted}>
            {errorMessage ?? "Could not load this recipe."}
          </Text>
          <Button title="Retry" onPress={loadRecipe} style={styles.retryBtn} />
        </View>
      </View>
    );
  }

  if (steps.length === 0) {
    return (
      <View style={[styles.fullScreen, { paddingTop: insets.top + Space.md }]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={Space.md}>
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.muted}>
            This recipe has no steps to cook yet.
          </Text>
        </View>
      </View>
    );
  }

  // ---- Feedback / submitting / done phases ----
  if (phase === "feedback" || phase === "submitting" || phase === "done") {
    const submitting = phase === "submitting";
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
          <Text style={styles.feedbackTitle}>You cooked it!</Text>

          <View style={styles.feedbackStatsRow}>
            <View
              style={[
                styles.totalPill,
                { backgroundColor: Color.accentSoft },
              ]}
            >
              <Text style={[styles.totalPillValue, { color: Color.accent }]}>
                {fmtMinutes(summary.total_actual_minutes)}
              </Text>
              <Text style={styles.totalPillLabel}>total cooked</Text>
            </View>
            {summary.cleanup_minutes != null ? (
              <View
                style={[
                  styles.totalPill,
                  { backgroundColor: Color.surfaceSoft },
                ]}
              >
                <Text
                  style={[styles.totalPillValue, { color: Color.inkSecondary }]}
                >
                  {fmtMinutes(summary.cleanup_minutes)}
                </Text>
                <Text style={styles.totalPillLabel}>cleanup</Text>
              </View>
            ) : null}
          </View>

          {cleanupEstimate != null ? (
            <Text style={styles.cleanupEstimate}>
              Cleanup estimate: ~{Math.round(cleanupEstimate)} min
            </Text>
          ) : null}

          {phase !== "done" ? (
            <>
              <Text style={styles.feedbackPrompt}>
                How did it feel vs. the estimate?
              </Text>
              <View style={styles.feedbackButtons}>
                <Card
                  onPress={submitting ? undefined : () => handleSubmit("faster")}
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: Color.successSoft },
                  ]}
                >
                  <Text style={[styles.feedbackCardText, { color: Color.success }]}>
                    Faster
                  </Text>
                </Card>
                <Card
                  onPress={
                    submitting ? undefined : () => handleSubmit("as_expected")
                  }
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: Color.amberSoft },
                  ]}
                >
                  <Text style={[styles.feedbackCardText, { color: "#8A5A12" }]}>
                    As expected
                  </Text>
                </Card>
                <Card
                  onPress={submitting ? undefined : () => handleSubmit("slower")}
                  padding={Space.lg}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: Color.dangerSoft },
                  ]}
                >
                  <Text style={[styles.feedbackCardText, { color: Color.danger }]}>
                    Slower
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
                    submitMsg.startsWith("Could not")
                      ? { color: Color.danger }
                      : { color: Color.success },
                  ]}
                >
                  {submitMsg}
                </Text>
              ) : null}
              <Button title="Done" onPress={finish} fullWidth size="lg" />
            </View>
          )}

          {submitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator color={Color.accent} size="small" />
              <Text style={styles.muted}>Saving…</Text>
            </View>
          ) : phase !== "done" ? (
            <Button title="Skip" variant="ghost" onPress={() => handleSubmit(null)} />
          ) : null}
        </View>
      </View>
    );
  }

  // ---- Cooking phase ----
  const step = steps[currentIndex];
  const tState = timerState[currentIndex] ?? "idle";
  const acc = elapsedMs[currentIndex] ?? 0;
  const live =
    tState === "running" ? acc + (now - stepStartRef.current) : acc;

  const timerColor =
    tState === "running"
      ? Color.ink
      : tState === "done"
        ? Color.success
        : Color.inkSecondary;

  const statusHint =
    tState === "idle"
      ? "Press Start when you begin this step"
      : tState === "running"
        ? "Timing…"
        : tState === "paused"
          ? "Paused"
          : "Step complete";

  return (
    <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={Space.md}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <Text style={styles.overline}>
          {`STEP ${currentIndex + 1} / ${steps.length}`}
        </Text>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {recipe.title}
        </Text>
      </View>

      {/* Step dots */}
      <View style={styles.dotsRow}>
        <StepDots
          count={steps.length}
          current={currentIndex}
          done={timerState.map((t) => t === "done")}
          onJump={onJump}
        />
      </View>

      {/* Single-step body (remounts on index change) */}
      <View key={currentIndex} style={styles.stepBody}>
        <View style={styles.stepMetaRow}>
          <Badge
            label={(step.step_type || "active").toUpperCase()}
            stepType={step.step_type}
          />
          <Chip
            tone="amber"
            label={`~${fmtMinutes(step.community_minutes ?? 0)} est`}
            size="sm"
          />
        </View>

        <Text style={[styles.timer, { color: timerColor }]}>
          {formatMSS(live)}
        </Text>
        <Text style={styles.statusHint}>{statusHint}</Text>

        <Card style={styles.descCard} padding={Space.xl} shadow="card">
          <Text style={styles.stepDescription}>{step.description}</Text>
        </Card>
      </View>

      {/* Footer: timer control + navigation row */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Space.sm,
            paddingHorizontal: Space.lg,
          },
        ]}
      >
        {tState === "idle" ? (
          <Button
            title="Start timer"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => startTimer(currentIndex)}
          />
        ) : tState === "running" ? (
          <Button
            title="Pause"
            variant="secondary"
            size="lg"
            fullWidth
            onPress={() => pauseTimer(currentIndex)}
          />
        ) : tState === "paused" ? (
          <Button
            title="Resume"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => resumeTimer(currentIndex)}
          />
        ) : (
          <Button title="Done ✓" variant="ghost" size="lg" fullWidth disabled />
        )}

        <View style={styles.navRow}>
          <Button
            title="Previous"
            variant="ghost"
            size="md"
            disabled={currentIndex === 0}
            onPress={prevStep}
          />
          {/* flex on the wrapper View (never on the Pressable itself) so the
              button stretches without the Android paint-collapse quirk. */}
          <View style={styles.navNextBtn}>
            <Button
              title={currentIndex === steps.length - 1 ? "Finish" : "Next"}
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

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: Color.canvas,
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
    color: Color.inkSecondary,
    textAlign: "center",
  },
  errorTitle: {
    ...Type.h3,
    color: Color.danger,
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
    color: Color.inkSecondary,
  },
  overline: {
    ...Type.overline,
    color: Color.inkSecondary,
    textTransform: "uppercase",
  },
  headerTitle: {
    ...Type.bodySm,
    color: Color.inkFaint,
    maxWidth: 120,
    textAlign: "right",
    flexShrink: 1,
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
    color: Color.inkSecondary,
    textAlign: "center",
  },
  descCard: {
    width: "100%",
  },
  stepDescription: {
    ...Type.body,
    fontSize: 17,
    lineHeight: 24,
    color: Color.ink,
    textAlign: "left",
  },
  // Footer
  footer: {
    backgroundColor: Color.surface,
    borderTopWidth: 1,
    borderTopColor: Color.hairline,
    paddingTop: Space.lg,
    gap: Space.sm,
    ...Shadow.floating,
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
    color: Color.ink,
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
    color: Color.inkFaint,
    marginTop: Space.xs,
    textTransform: "uppercase",
  },
  cleanupEstimate: {
    ...Type.caption,
    color: Color.inkSecondary,
    fontWeight: "500",
  },
  feedbackPrompt: {
    ...Type.body,
    color: Color.inkSecondary,
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
});
