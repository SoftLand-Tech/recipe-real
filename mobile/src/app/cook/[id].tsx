import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  type ViewStyle,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getRecipe, submitCookSession } from "@/api/client";
import { track } from "@/analytics";
import {
  flushPendingCookSessions,
  getCachedRecipe,
  getPendingCookSessionCount,
} from "@/db/database";
import type {
  CookSessionPayload,
  Feedback,
  Recipe,
  RecipeStep,
} from "@/types";

type LoadState = "loading" | "ready" | "error";
type Phase = "cooking" | "feedback" | "submitting" | "done";

const SCREEN_WIDTH = Dimensions.get("window").width;
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

function badgeColor(stepType: string): ViewStyle {
  switch (stepType) {
    case "active":
      return { backgroundColor: "#FEF3C7" };
    case "cleanup":
      return { backgroundColor: "#E0E7FF" };
    case "passive":
    default:
      return { backgroundColor: "#DCFCE7" };
  }
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
  /** Whether the current step's clock is running (resets to true per step). */
  const [running, setRunning] = useState(true);
  /** Re-render tick: only updated while running, to drive the live display. */
  const [now, setNow] = useState(Date.now());

  const runningRef = useRef(true);
  const stepStartRef = useRef<number>(Date.now());
  // Stable per-session idempotency key (generated on first submission) so
  // retried/offline-replayed POSTs don't create duplicate cook sessions.
  const idempotencyKey = useRef<string>("");

  const [phase, setPhase] = useState<Phase>("cooking");
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const listRef = useRef<FlatList<RecipeStep>>(null);

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
      if (!result) {
        result = await getRecipe(id);
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

  // Initialize the elapsed array + step start once steps are known.
  useEffect(() => {
    if (steps.length > 0 && elapsedMs.length === 0) {
      setElapsedMs(new Array(steps.length).fill(0));
      stepStartRef.current = Date.now();
      runningRef.current = true;
      setRunning(true);
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
  useEffect(() => {
    if (!running || phase !== "cooking") return;
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, [running, phase]);

  // ---- Pager sync ----------------------------------------------------------
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    [],
  );

  // Keep the FlatList page in sync with currentIndex.
  useEffect(() => {
    if (steps.length === 0) return;
    const clamped = Math.max(0, Math.min(currentIndex, steps.length - 1));
    listRef.current?.scrollToIndex({
      index: clamped,
      animated: true,
    });
  }, [currentIndex, steps.length]);

  const onMomentumScrollEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      if (idx !== currentIndex && idx >= 0 && idx < steps.length) {
        // Swiping away folds the live segment of the step we're leaving.
        commitLiveSegment();
        setCurrentIndex(idx);
        // Reset running state for the newly entered step (default running).
        stepStartRef.current = Date.now();
        runningRef.current = true;
        setRunning(true);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentIndex, steps.length],
  );

  // ---- Timer actions -------------------------------------------------------
  /** Fold the current running segment into elapsedMs[currentIndex]. */
  const commitLiveSegment = useCallback(() => {
    if (!runningRef.current) return;
    const delta = Date.now() - stepStartRef.current;
    setElapsedMs((prev) => {
      const next = [...prev];
      const i = currentIndex;
      next[i] = (next[i] ?? 0) + delta;
      return next;
    });
  }, [currentIndex]);

  const togglePause = useCallback(() => {
    if (runningRef.current) {
      // Pause: fold live elapsed, stop running.
      commitLiveSegment();
      runningRef.current = false;
      setRunning(false);
    } else {
      // Resume: start a new segment.
      stepStartRef.current = Date.now();
      runningRef.current = true;
      setRunning(true);
      setNow(Date.now());
    }
  }, [commitLiveSegment]);

  /** "Done" on current step: fold live elapsed, stop, advance. */
  const completeStep = useCallback(() => {
    commitLiveSegment();
    runningRef.current = false;
    setRunning(false);
    if (currentIndex >= steps.length - 1) {
      // Last step done -> feedback phase.
      setPhase("feedback");
    } else {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      // Start the next step running.
      stepStartRef.current = Date.now();
      runningRef.current = true;
      setRunning(true);
      setNow(Date.now());
    }
  }, [commitLiveSegment, currentIndex, steps.length]);

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
    router.replace(`/recipe/${id}`);
  }, [id]);

  const renderItem: ListRenderItem<RecipeStep> = useCallback(
    ({ item, index }) => {
      const isCurrent = index === currentIndex;
      const acc = elapsedMs[index] ?? 0;
      const live =
        isCurrent && running && phase === "cooking"
          ? acc + (now - stepStartRef.current)
          : acc;
      return (
        <View style={styles.page}>
          <View style={styles.stepCard}>
            <View style={styles.stepMeta}>
              <View
                style={[styles.badge, badgeColor(item.step_type)]}
              >
                <Text style={styles.badgeText}>
                  {(item.step_type || "active").toUpperCase()}
                </Text>
              </View>
              <Text style={styles.estimate}>
                {item.community_minutes != null
                  ? `~${Math.round(item.community_minutes)} min estimate`
                  : ""}
              </Text>
            </View>
            <Text style={styles.timer}>{formatMSS(live)}</Text>
            <Text style={styles.stepDescription}>{item.description}</Text>
          </View>
        </View>
      );
    },
    [currentIndex, elapsedMs, now, running, phase],
  );

  // ---- Render --------------------------------------------------------------
  if (loadState === "loading") {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
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
          <Pressable style={styles.button} onPress={loadRecipe}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (steps.length === 0) {
    return (
      <View
        style={[styles.fullScreen, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeText}>Close</Text>
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

  // ---- Feedback / done phases ----
  if (phase === "feedback" || phase === "submitting" || phase === "done") {
    return (
      <View
        style={[
          styles.fullScreen,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View style={styles.feedbackWrap}>
          <Text style={styles.feedbackTitle}>You cooked it!</Text>
          <Text style={styles.summaryTotal}>
            {summary.total_actual_minutes} min
            {summary.cleanup_minutes != null
              ? ` · cleanup ${summary.cleanup_minutes}`
              : ""}
          </Text>
          {cleanupEstimate != null ? (
            <Text style={styles.cleanupEstimate}>
              Cleanup estimate: ~{Math.round(cleanupEstimate)} min
            </Text>
          ) : null}
          <Text style={styles.muted}>How did it feel vs. the estimate?</Text>

          {phase !== "done" ? (
            <View style={styles.feedbackButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.feedbackBtn,
                  styles.fasterBtn,
                  pressed && styles.feedbackBtnPressed,
                ]}
                disabled={phase === "submitting"}
                onPress={() => handleSubmit("faster")}
              >
                <Text style={styles.feedbackBtnText}>Faster</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.feedbackBtn,
                  styles.expectedBtn,
                  pressed && styles.feedbackBtnPressed,
                ]}
                disabled={phase === "submitting"}
                onPress={() => handleSubmit("as_expected")}
              >
                <Text style={styles.feedbackBtnText}>As expected</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.feedbackBtn,
                  styles.slowerBtn,
                  pressed && styles.feedbackBtnPressed,
                ]}
                disabled={phase === "submitting"}
                onPress={() => handleSubmit("slower")}
              >
                <Text style={styles.feedbackBtnText}>Slower</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.doneWrap}>
              {submitMsg ? (
                <Text style={styles.savedMsg}>{submitMsg}</Text>
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  styles.doneBtn,
                  pressed && styles.doneBtnPressed,
                ]}
                onPress={finish}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          )}

          {phase !== "done" ? (
            <Pressable
              style={styles.skipBtn}
              disabled={phase === "submitting"}
              onPress={() => handleSubmit(null)}
            >
              <Text style={styles.skipText}>
                {phase === "submitting" ? "Saving…" : "Skip"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // ---- Cooking phase ----
  const step = steps[currentIndex];
  const progressText = `Step ${currentIndex + 1} of ${steps.length}`;

  return (
    <View
      style={[
        styles.fullScreen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
        <Text style={styles.progressText}>{progressText}</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled
        getItemLayout={getItemLayout}
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollToIndexFailed={({ index }) => {
          // Fallback if layout isn't ready yet.
          listRef.current?.scrollToIndex({ index, animated: false });
        }}
        contentContainerStyle={styles.listContent}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.pauseBtn,
            pressed && styles.pauseBtnPressed,
          ]}
          onPress={togglePause}
        >
          <Text style={styles.pauseBtnText}>
            {running ? "Pause" : "Resume"}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.doneStepBtn,
            pressed && styles.doneStepBtnPressed,
          ]}
          onPress={completeStep}
        >
          <Text style={styles.doneStepBtnText}>
            {currentIndex >= steps.length - 1 ? "Finish" : "Done"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  muted: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
  },
  errorTitle: {
    color: "#B91C1C",
    fontSize: 16,
    fontWeight: "600",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  closeText: {
    color: "#2563EB",
    fontSize: 15,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  listContent: {
    flexGrow: 1,
  },
  page: {
    width: SCREEN_WIDTH,
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  stepCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  stepMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  badge: {
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#374151",
  },
  estimate: {
    marginLeft: "auto",
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },
  timer: {
    fontSize: 64,
    fontWeight: "800",
    color: "#111827",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1,
  },
  stepDescription: {
    fontSize: 18,
    color: "#111827",
    lineHeight: 26,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  pauseBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  pauseBtnPressed: {
    backgroundColor: "#E5E7EB",
  },
  pauseBtnText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 16,
  },
  doneStepBtn: {
    flex: 2,
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneStepBtnPressed: {
    backgroundColor: "#1D4ED8",
  },
  doneStepBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  // Feedback phase
  feedbackWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  feedbackTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  summaryTotal: {
    fontSize: 20,
    color: "#2563EB",
    fontWeight: "700",
  },
  cleanupEstimate: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  feedbackButtons: {
    width: "100%",
    gap: 12,
    marginTop: 16,
  },
  feedbackBtn: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  feedbackBtnPressed: {
    opacity: 0.85,
  },
  fasterBtn: {
    backgroundColor: "#DCFCE7",
  },
  expectedBtn: {
    backgroundColor: "#FEF3C7",
  },
  slowerBtn: {
    backgroundColor: "#FFE4E6",
  },
  feedbackBtnText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 18,
  },
  skipBtn: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "600",
  },
  // Done
  doneWrap: {
    width: "100%",
    alignItems: "center",
    gap: 16,
    marginTop: 16,
  },
  savedMsg: {
    color: "#16A34A",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
  },
  doneBtn: {
    width: "100%",
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  doneBtnPressed: {
    backgroundColor: "#1D4ED8",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
});
