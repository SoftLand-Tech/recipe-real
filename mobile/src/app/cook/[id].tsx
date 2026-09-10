import { useLocalSearchParams, router } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  alarmAvailable,
  cancelStepAlarm,
  formatCookElapsed,
  initCookEventHandlers,
  openAlarmPermissionSettings,
  requestAlarmPermission,
  scheduleStepAlarm,
  startCookNotification,
  stopCookNotification,
} from "@/utils/cookAlarms";
import { stepMinutes } from "@/utils/recipeTime";

import { getRecipe, submitCookSession } from "@/api/client";
import { track } from "@/analytics";
import {
  flushPendingCookSessions,
  getCachedRecipe,
  getPendingCookSessionCount,
  upsertRecipes,
} from "@/db/database";
import { Button, Badge, Chip, Card, IconPressable, StepDots, ActionSheet } from "@/components/ui";
import {
  useFmtMinutes,
  useLang,
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

/**
 * Live-tick interval (ms). The display only resolves to whole seconds, so
 * 500ms is plenty smooth and halves the wakeups vs the old 250ms — and the
 * tick state lives inside the memoized children below, never in the screen.
 */
const TICK_MS = 500;

// ---- Whole-recipe stopwatch math ---------------------------------------------

/** One closed pause interval of the stopwatch, in wall-clock epoch ms. */
interface PauseInterval {
  from: number;
  to: number;
}

/**
 * One visit to a step: wall-clock entry instant + exit instant (null while
 * the visit is still open). Revisits append new entries — per-step time is
 * the SUM of a step's visits, so Back-then-Next loiter is attributed to
 * the step actually on screen, never to the step you left.
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

/** AsyncStorage shape for a cook session that must survive an OS kill. */
interface PersistedCookSession {
  v: 1;
  recipeId: number;
  cookStartAt: number;
  pausedAt: number | null;
  pausedMsTotal: number;
  pauses: PauseInterval[];
  stepMarks: Record<number, number>;
  visits: StepVisit[];
  currentIndex: number;
  status: CookStatus;
  armedAlarmId: string | null;
  armedStep: number | null;
}

/** Sessions older than this are never restored (stale kill residue). */
const MAX_RESTORE_AGE_MS = 24 * 60 * 60 * 1000;

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

// ---- Memoized live-timer children -------------------------------------------
// The tick state lives HERE, not in the screen: while the stopwatch runs,
// only these small components re-render every TICK_MS. The parent screen
// re-renders only on real state changes (step nav, pause/resume, arming).

interface ElapsedTimerProps {
  cookStartAt: number | null;
  pausedAt: number | null;
  pausedMsTotal: number;
  /** Tick only while true (running + cooking phase). */
  running: boolean;
  timerStyle: TextStyle;
  color: string;
}

/** Whole-recipe stopwatch readout. Owns its tick; parent never re-renders. */
const ElapsedTimer = memo(function ElapsedTimer({
  cookStartAt,
  pausedAt,
  pausedMsTotal,
  running,
  timerStyle,
  color,
}: ElapsedTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || cookStartAt == null || pausedAt != null) return;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, [running, cookStartAt, pausedAt]);
  const elapsedMs =
    cookStartAt == null
      ? 0
      : Math.max(0, (pausedAt ?? now) - cookStartAt - pausedMsTotal);
  return (
    <Text style={[timerStyle, { color }]}>{formatCookElapsed(elapsedMs)}</Text>
  );
});

interface StepPaceBarProps {
  /** Tick only while true; otherwise the frozen snapshot is shown. */
  running: boolean;
  /** Pause-adjusted elapsed to show while NOT running (fresh at pause). */
  frozenMs: number;
  /** Pause-adjusted elapsed for the live tick (stable callback over refs). */
  getElapsedMs: (now: number) => number;
  expectedMs: number;
  wrapStyle: ViewStyle;
  trackStyle: ViewStyle;
  fillStyle: ViewStyle;
  fillOverStyle: ViewStyle;
  textStyle: TextStyle;
  overColor: string;
  normalColor: string;
}

/** Per-step pace bar. Owns its tick; parent never re-renders for it. */
const StepPaceBar = memo(function StepPaceBar({
  running,
  frozenMs,
  getElapsedMs,
  expectedMs,
  wrapStyle,
  trackStyle,
  fillStyle,
  fillOverStyle,
  textStyle,
  overColor,
  normalColor,
}: StepPaceBarProps) {
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const handle = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(handle);
  }, [running]);
  const elapsedMs = running ? getElapsedMs(now) : frozenMs;
  const overMin =
    elapsedMs > expectedMs
      ? Math.max(1, Math.round((elapsedMs - expectedMs) / 60_000))
      : 0;
  const pct = Math.min(1, expectedMs > 0 ? elapsedMs / expectedMs : 0);
  return (
    <View style={wrapStyle}>
      <View style={trackStyle}>
        <View
          style={[
            overMin > 0 ? fillOverStyle : fillStyle,
            { width: `${Math.round(pct * 100)}%` },
          ]}
        />
      </View>
      <Text style={[textStyle, { color: overMin > 0 ? overColor : normalColor }]}>
        {overMin > 0
          ? t("cook.stepOver", { n: overMin })
          : t("cook.stepExpected", { n: Math.round(expectedMs / 60_000) })}
      </Text>
    </View>
  );
});

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
  // Reactive layout direction (from the language preference) — the native
  // I18nManager flag can be stale for a session after an in-app language
  // flip, which left the nav arrows "not quite mirrored" in Arabic.
  const { dir } = useLang();
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
        goHomeBtn: {
          marginTop: Space.xs,
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
        alarmChipWrap: {
          // Static-style wrapper so the tappable chip centers cleanly.
        },
        alarmNeedsApp: {
          ...Type.caption,
          color: colors.inkFaint,
          textAlign: "center",
          marginTop: -Space.sm,
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
          gap: Space.md,
        },
        primaryBtn: {
          flex: 1,
        },
        // Circular step-nav buttons flanking the Pause/Resume pill —
        // visible soft fill + hairline (never transparent), static styles.
        ctrlCircle: {
          width: 52,
          height: 52,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        ctrlCircleDisabled: {
          opacity: 0.4,
        },
        // Last step: the forward circle becomes a filled accent ✓ (finish).
        ctrlCircleDone: {
          width: 52,
          height: 52,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
          alignItems: "center",
          justifyContent: "center",
        },
        finishRow: {
          marginTop: Space.xs,
        },
        // Step pace bar: teal fill toward the step's expected duration,
        // amber when past it.
        stepPaceWrap: {
          width: "100%",
          gap: Space.xs,
          marginTop: Space.xl,
        },
        stepTrack: {
          height: 6,
          borderRadius: Radius.pill,
          backgroundColor: colors.surfaceSoft,
          overflow: "hidden",
        },
        stepFill: {
          height: "100%",
          borderRadius: Radius.pill,
          backgroundColor: colors.timing,
        },
        stepFillOver: {
          height: "100%",
          borderRadius: Radius.pill,
          backgroundColor: colors.amber,
        },
        stepPaceText: {
          ...Type.caption,
          fontWeight: "600",
          textAlign: "center",
        },
        // Next-step preview under the description card.
        nextWrap: {
          width: "100%",
          gap: Space.xs,
          marginTop: Space.md,
        },
        nextLabel: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        nextText: {
          ...Type.bodySm,
          color: colors.inkSecondary,
        },
        // "Recipe said X — you took Y" reality check on the feedback screen.
        vsClaim: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          textAlign: "center",
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
  /**
   * Session-persistence hydration gate: the restore-from-AsyncStorage effect
   * sets this once it has attempted a restore, and the persist effect stays
   * silent until then — so the initial empty state can never clobber a
   * session saved before an OS kill. No tick state lives here anymore: the
   * memoized ElapsedTimer/StepPaceBar children own their intervals, so the
   * whole screen no longer re-renders every tick.
   */
  const [hydrated, setHydrated] = useState(false);

  /**
   * Ref mirror of `status` so async callbacks (the background recipe
   * revalidation) can check "is a cook session active?" without subscribing
   * to every status change. Kept in sync by the effect below.
   */
  const statusRef = useRef<CookStatus>("idle");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  /** Pause log (closed intervals) — subtracted from each step's segment. */
  const pausesRef = useRef<PauseInterval[]>([]);
  /**
   * Wall-clock instant each step was FIRST entered (keyed by step_number).
   * Drives the visited-dots only — per-step DURATIONS come from the visit
   * log below, so Back-then-Next loiter can't leak into the wrong step.
   * Steps never entered have no mark and submit 0 minutes.
   */
  const stepMarksRef = useRef<Record<number, number>>({});
  /**
   * Segment log: every (enter, exit) visit per step. goToStep closes the
   * open visit and opens a new one; finishCooking closes the last visit at
   * the finish instant. Durations = sum of pause-adjusted visits per step.
   */
  const visitsRef = useRef<StepVisit[]>([]);
  /**
   * Monotonic alarm-arm generation: every clearArmedAlarm() bumps it and
   * every armStepAlarm() claims the latest value after each await — a stale
   * (superseded by fast Next/Back taps) arm aborts instead of committing,
   * so only the latest arm owns the armed alarm id.
   */
  const armGenRef = useRef(0);

  /** Armed step alarm: id in a ref (event handlers), step number for render. */
  const armedAlarmIdRef = useRef<string | null>(null);
  // Step the user manually DISARMED — auto-arm must not fight them on the
  // same step (re-arms only after leaving and re-entering it).
  const lastAutoArmStepRef = useRef<number | null>(null);
  const [armedStep, setArmedStep] = useState<number | null>(null);
  // Confirmations (the app's ActionSheet — never native Alerts): finishing
  // an active cook, and discarding one via ✕ / back.
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Alarms need the NATIVE notifee module: null = still resolving,
  // false = Expo Go / unavailable (chip renders muted + caption).
  const [alarmsUsable, setAlarmsUsable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    alarmAvailable().then((ok) => {
      if (!cancelled) setAlarmsUsable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ---- Session persistence (survive background kill) -------------------------
  // cookStartAt / pauses / visit log used to live only in state+refs: an OS
  // kill reset the stopwatch to idle and the timings were gone. They are now
  // written to AsyncStorage on every change and restored on mount, so after
  // a kill the session restores its elapsed and the user can resume or
  // submit from the restored screen.
  //
  // Wall-clock note: elapsed derives from Date.now() stamps, so a manual
  // clock change mid-cook still skews it — no monotonic clock survives a
  // kill to persist against. Persistence guarantees the session SURVIVES,
  // not that it is immune to clock edits.
  const sessionKey = `cook-session:${String(id)}`;
  const clearPersistedSession = useCallback(() => {
    void AsyncStorage.removeItem(sessionKey).catch(() => {});
  }, [sessionKey]);

  // Restore once, when the recipe is ready. Stale (>24h) or foreign-recipe
  // snapshots are discarded; the armed alarm id is restored too so an alarm
  // scheduled before the kill can still be cancelled (its fire time was
  // absolute, so it still fires correctly).
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (loadState !== "ready" || !recipe || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(sessionKey);
        if (raw != null) {
          const saved = JSON.parse(raw) as PersistedCookSession;
          const fresh =
            saved != null &&
            saved.v === 1 &&
            saved.recipeId === recipe.id &&
            typeof saved.cookStartAt === "number" &&
            Date.now() - saved.cookStartAt < MAX_RESTORE_AGE_MS;
          if (!fresh) {
            await AsyncStorage.removeItem(sessionKey).catch(() => {});
          } else if (statusRef.current === "idle") {
            pausesRef.current = Array.isArray(saved.pauses)
              ? saved.pauses.filter(
                  (p) =>
                    p != null &&
                    typeof p.from === "number" &&
                    typeof p.to === "number",
                )
              : [];
            stepMarksRef.current =
              saved.stepMarks != null && typeof saved.stepMarks === "object"
                ? saved.stepMarks
                : {};
            // Kept as-is INCLUDING the still-open visit (to == null): the
            // wall clock kept running while dead, exactly as when
            // backgrounded, so its time accrues to the current step.
            visitsRef.current = Array.isArray(saved.visits)
              ? saved.visits.filter(
                  (seg) =>
                    seg != null &&
                    typeof seg.stepNumber === "number" &&
                    typeof seg.from === "number" &&
                    (seg.to == null || typeof seg.to === "number"),
                )
              : [];
            const paused = saved.status === "paused";
            setCookStartAt(saved.cookStartAt);
            setPausedAt(paused ? (saved.pausedAt ?? saved.cookStartAt) : null);
            setPausedMsTotal(
              typeof saved.pausedMsTotal === "number"
                ? saved.pausedMsTotal
                : 0,
            );
            setStatus(paused ? "paused" : "running");
            setCurrentIndex(
              Math.min(
                Math.max(0, saved.currentIndex ?? 0),
                Math.max(0, steps.length - 1),
              ),
            );
            if (saved.armedAlarmId != null && saved.armedStep != null) {
              armedAlarmIdRef.current = saved.armedAlarmId;
              setArmedStep(saved.armedStep);
            }
            // Re-post the Android notification so the chronometer and quick
            // actions live again for the restored session.
            void startCookNotification({
              recipeTitle: lr.title(recipe),
              recipeId: recipe.id,
              startedAt: saved.cookStartAt,
              pausedMs:
                typeof saved.pausedMsTotal === "number"
                  ? saved.pausedMsTotal
                  : 0,
              paused,
              t,
            });
          }
        }
      } catch {
        // Corrupt snapshot: start idle, never crash the screen.
      }
      setHydrated(true);
    })();
    // Runs once per mount (restoreAttemptedRef); recipe/steps are the
    // mount-time values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, recipe, sessionKey]);

  // Persist on every change (refs are read synchronously here — each of them
  // only ever mutates alongside one of these state updates). Skipped until
  // hydration completes so the initial idle state can't wipe a snapshot,
  // and skipped after finish (finishCooking clears the key explicitly).
  useEffect(() => {
    if (!hydrated || phase !== "cooking" || status === "finished") return;
    if (cookStartAt == null) {
      void AsyncStorage.removeItem(sessionKey).catch(() => {});
      return;
    }
    const payload: PersistedCookSession = {
      v: 1,
      recipeId: recipe?.id ?? Number(id),
      cookStartAt,
      pausedAt,
      pausedMsTotal,
      pauses: pausesRef.current,
      stepMarks: stepMarksRef.current,
      visits: visitsRef.current,
      currentIndex,
      status,
      armedAlarmId: armedAlarmIdRef.current,
      armedStep,
    };
    void AsyncStorage.setItem(sessionKey, JSON.stringify(payload)).catch(
      () => {},
    );
  }, [
    hydrated,
    phase,
    status,
    cookStartAt,
    pausedMsTotal,
    pausedAt,
    currentIndex,
    armedStep,
    recipe,
    id,
    sessionKey,
  ]);

  // ---- Load recipe ---------------------------------------------------------
  // Monotonic load id: only the LATEST loadRecipe may commit state, so a
  // background revalidation or a retry can never clobber a newer recipe.
  const loadRequestIdRef = useRef(0);
  const loadRecipe = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoadState("loading");
    setErrorMessage(null);
    try {
      const numericId = Number(id);
      // 1. Serve the cached copy immediately (fast paint + offline support).
      let result = await getCachedRecipe(numericId);
      const servedFromCache =
        result != null && (result.recipe_steps?.length ?? 0) > 0;
      if (!servedFromCache) {
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
      if (requestId !== loadRequestIdRef.current) return;
      setRecipe(result);
      setLoadState("ready");
      // 2. Revalidate in the background when we served the cached copy, so a
      // stale cache never pins this screen forever. Guard: NEVER swap the
      // recipe (or its steps) while a cook session is active — a mid-cook
      // step change would disturb the live stopwatch. Only the LATEST
      // loadRecipe may commit (request-id guard).
      if (servedFromCache) {
        getRecipe(id)
          .then((fetched) => {
            if (requestId !== loadRequestIdRef.current) return;
            if (statusRef.current !== "idle") return;
            upsertRecipes([fetched], { withSteps: true }).catch(() => {});
            setRecipe(fetched);
          })
          .catch((error) => {
            // Offline / 402: the cached copy stays — it's already on screen.
            console.warn("[RecipeReal] cook revalidation failed:", error);
          });
      }
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

  // ---- Pause-adjusted elapsed ----------------------------------------------
  // The live display derives from cookStartAt/pausedAt/pausedMsTotal, so the
  // correct elapsed reappears after ANY amount of backgrounded time — and it
  // is computed inside the memoized ElapsedTimer/StepPaceBar children, which
  // own the tick (see above). Nothing in this screen re-renders on a timer.

  // ---- Step alarms (notifee; no-op in Expo Go) ------------------------------

  /**
   * Cancel the armed step alarm, if any. Idempotent; never throws. Bumps
   * the arm generation so any in-flight armStepAlarm() aborts instead of
   * committing a stale alarm after this cancel.
   */
  const clearArmedAlarm = useCallback(async () => {
    armGenRef.current++;
    const alarmId = armedAlarmIdRef.current;
    armedAlarmIdRef.current = null;
    setArmedStep(null);
    await cancelStepAlarm(alarmId);
  }, []);

  /** Arm the alarm for step `step` (minutes from its text). Silent no-op
   * paths return false so the chip tap can surface a failure message. */
  const armStepAlarm = useCallback(
    async (step: RecipeStep): Promise<boolean> => {
      const minutes = step.literal_minutes;
      if (!recipe || typeof minutes !== "number" || minutes <= 0) {
        return false;
      }
      await clearArmedAlarm();
      // Claim the latest arm generation AFTER the clear's own bump: any arm
      // started earlier (fast Next/Back taps racing these awaits) now holds
      // a stale token and must abort instead of committing.
      const gen = armGenRef.current + 1;
      armGenRef.current = gen;
      if (!(await requestAlarmPermission())) return false;
      if (gen !== armGenRef.current) return false;
      const { id, exactAlarmDenied } = await scheduleStepAlarm({
        recipeTitle: lr.title(recipe),
        stepNumber: step.step_number,
        minutes,
        t,
      });
      if (gen !== armGenRef.current) {
        // Superseded while the schedule await was in flight: cancel the
        // orphan so a stale alarm can't fire on the wrong step.
        if (id) await cancelStepAlarm(id);
        return false;
      }
      if (id) {
        armedAlarmIdRef.current = id;
        setArmedStep(step.step_number);
        track("alarm_armed", {
          recipe_id: recipe.id,
          step_number: step.step_number,
          minutes,
        });
        return true;
      }
      // Android 14+ denies exact alarms by default for new installs —
      // send the user to the OS switch once; silent failure helps nobody.
      if (exactAlarmDenied) {
        Alert.alert(
          t("cook.alarmPermTitle"),
          t("cook.alarmPermMessage"),
          [
            { text: t("common.cancel"), style: "cancel" },
            {
              text: t("cook.alarmPermOpen"),
              onPress: () => void openAlarmPermissionSettings(),
            },
          ],
        );
      }
      return false;
    },
    [recipe, clearArmedAlarm, lr, t],
  );

  /** Arm (or cancel, when already armed) the alarm for the current step. */
  const onAlarmChipPress = useCallback(async () => {
    const step = steps[currentIndex];
    if (!step) return;
    // One armed alarm at a time: tapping the armed chip cancels it (and
    // stamps the step so auto-arm doesn't instantly re-arm against the
    // user's wish); tapping a disarmed chip re-arms.
    if (armedStep === step.step_number) {
      lastAutoArmStepRef.current = step.step_number;
      await clearArmedAlarm();
      return;
    }
    lastAutoArmStepRef.current = null;
    await armStepAlarm(step);
  }, [steps, currentIndex, armedStep, clearArmedAlarm, armStepAlarm]);

  // AUTO-ARM: entering a timed step while the stopwatch is running starts
  // its alarm automatically — an alarm you must know to arm is barely an
  // alarm. A manual cancel on this step suppresses the re-arm until the
  // user leaves and comes back.
  useEffect(() => {
    if (phase !== "cooking" || status !== "running") return;
    const step = steps[currentIndex];
    if (!step) return;
    const minutes = step.literal_minutes;
    if (typeof minutes !== "number" || minutes <= 0) return;
    if (armedStep != null) return;
    if (lastAutoArmStepRef.current === step.step_number) return;
    void armStepAlarm(step);
    // Deliberately not keyed on armStepAlarm/armedStep: this fires on step
    // ENTRY (and run resume) only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, status, phase, steps]);

  // ---- Stopwatch actions -----------------------------------------------------

  /**
   * Enter step `i` (post-Start): close the currently open visit at `at`,
   * stamp the first-entry mark (visited dots), and open a new visit for
   * this step. Revisits append visits — durations sum them — so loitering
   * via Back/Next is attributed to the step actually on screen.
   */
  const recordMark = useCallback(
    (i: number) => {
      if (cookStartAt == null) return;
      const stepNumber = steps[i]?.step_number;
      if (stepNumber == null) return;
      const at = Date.now();
      const visits = visitsRef.current;
      for (let k = visits.length - 1; k >= 0; k--) {
        if (visits[k].to == null) {
          visits[k].to = Math.max(at, visits[k].from);
          break;
        }
      }
      if (stepMarksRef.current[stepNumber] == null) {
        stepMarksRef.current[stepNumber] = at;
      }
      visits.push({ stepNumber, from: at, to: null });
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
   * the VISIT LOG (each step's pause-adjusted visit segments summed via
   * adjust(); unvisited steps submit 0) and move to the feedback phase.
   * Same handler for the Finish button, Next on the last step, and the
   * notification quick action.
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
      // Close the still-open visit at the finish instant so the tail of the
      // current step is counted exactly once.
      const visits = visitsRef.current;
      for (let k = visits.length - 1; k >= 0; k--) {
        if (visits[k].to == null) {
          visits[k].to = Math.max(endWall, visits[k].from);
          break;
        }
      }
      const perStep = steps.map((step) => {
        let ms = 0;
        for (const seg of visits) {
          if (seg.stepNumber !== step.step_number || seg.to == null) continue;
          ms += adjust(seg.from, seg.to, pauses);
        }
        return {
          step,
          actual_minutes: round2(Math.max(0, ms) / 60000),
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
    // Session over: drop the persisted snapshot so a later visit starts idle.
    clearPersistedSession();
  }, [
    recipe,
    phase,
    cookStartAt,
    pausedAt,
    steps,
    clearArmedAlarm,
    clearPersistedSession,
  ]);

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

  /**
   * Pause-adjusted time spent ON step `stepNumber` up to wall instant `at`:
   * closed visits summed plus the open visit's live portion. Stable (reads
   * refs only) — shared by the frozen parent snapshot and passed to the
   * ticking StepPaceBar child.
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

  /**
   * Leave Cook Mode after finishing: pop back to the recipe detail that
   * pushed this screen (it's still mounted right below in the stack).
   * Falls back to a replace when there's no history (deep link) — never
   * PUSH a duplicate detail on top.
   */
  const finish = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/recipe/${id}`);
    }
  }, [id]);

  /**
   * Close (✕ / back affordance). While a cook session is actually running
   * or paused, ask before discarding — the stopwatch and per-step timings
   * are lost otherwise. Idle (never started) and post-finish phases close
   * immediately. The ask is the app's ActionSheet (never a native Alert).
   */
  const requestClose = useCallback(() => {
    const sessionActive =
      phase === "cooking" && cookStartAt != null && status !== "finished";
    if (!sessionActive) {
      // Deep-link entry has no history — a bare back() would be a no-op
      // leaving the user stranded, so replace with the recipe detail.
      // Never PUSH a duplicate detail on top.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/recipe/${id}`);
      }
      return;
    }
    setConfirmDiscard(true);
  }, [phase, cookStartAt, status, id]);

  // Intercept the Android hardware/gesture back during an active session so
  // the discard confirmation applies to it too (not just the ✕ button).
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (phase === "cooking" && cookStartAt != null) {
        requestClose();
        return true;
      }
      // Deep-link entry has no history: the system back would exit the app —
      // route back to the recipe instead. Otherwise let the system pop.
      if (!router.canGoBack()) {
        router.replace(`/recipe/${id}`);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [phase, cookStartAt, requestClose, id]);

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
          {/* Escape hatch: never leave the user stranded on a dead cook
              screen — one tap back to the home tab. */}
          <Button
            title={t("common.goHome")}
            variant="ghost"
            onPress={() => {
              if (router.canDismiss()) {
                router.dismissTo("/");
              } else {
                router.replace("/");
              }
            }}
            style={styles.goHomeBtn}
          />
        </View>
      </View>
    );
  }

  if (steps.length === 0) {
    return (
      <View style={[styles.fullScreen, { paddingTop: insets.top + Space.md }]}>
        <View style={styles.headerRow}>
          <IconPressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(`/recipe/${id}`);
              }
            }}
            hitSlop={Space.md}
            accessibilityLabel={t("cook.closeA11y")}
          >
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

          {/* Reality check — the brand moment: the publisher's claim vs the
              stopwatch truth this session just recorded. */}
          {recipe?.publisher_time_minutes != null && totalCooked > 0 ? (
            <Text style={styles.vsClaim}>
              {t("cook.vsClaim", {
                claim: fmtMin(Math.round(recipe.publisher_time_minutes)),
                actual: fmtMin(totalCooked),
              })}
            </Text>
          ) : null}

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
              {/* Pace calibrations recompute in a background job (and after
                  an offline flush), so they can lag the save by seconds to
                  minutes — say so, or the Pace tab looks broken. */}
              {!submitFailed && submitMsg ? (
                <Text style={[styles.savedMsg, { color: colors.inkSecondary }]}>
                  {t("cook.pacePending")}
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
  const onLastStep = currentIndex === steps.length - 1;
  const upcomingStep = onLastStep ? null : steps[currentIndex + 1];

  // Expected duration for THIS step (best known estimate). The live
  // pause-adjusted time on it ticks inside StepPaceBar; the parent keeps
  // only this frozen snapshot (fresh: the parent re-renders on pause/nav).
  const expectedMin = stepMinutes(step);
  const stepExpectedMs =
    expectedMin != null && expectedMin > 0 ? expectedMin * 60_000 : null;
  const stepFrozenMs =
    cookStartAt != null
      ? stepVisitElapsedMs(step.step_number, pausedAt ?? Date.now())
      : 0;

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
        <IconPressable
          onPress={requestClose}
          hitSlop={Space.md}
          accessibilityLabel={t("cook.closeA11y")}
        >
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
          {/* Step ALARM chip — an explicit toggle, styled as an ACTION, not
              a tag: accent color (the app's button family — same family as
              the Pause button), outlined + raised while unarmed, filled
              accent pill with the filled icon when armed. The step-type
              Badge beside it stays amber/muted so actions and tags never
              share a color. In Expo Go (alarms can't run) it renders as a
              muted tag with a one-line caption instead. */}
          {alarmMinutes != null && alarmMinutes > 0 ? (
            <View style={styles.alarmChipWrap}>
              <IconPressable
                onPress={alarmsUsable === false ? undefined : onAlarmChipPress}
                disabled={alarmsUsable === false}
                hitSlop={Space.xs}
                accessibilityLabel={
                  alarmsUsable === false
                    ? t("cook.alarmNeedsAppCaption")
                    : alarmArmedHere
                      ? `${t("cook.alarmArmed")} · ${t("cook.alarmCancel")}`
                      : t("cook.alarmSet", {
                          minutes: Math.round(alarmMinutes),
                        })
                }
              >
                <Chip
                  tone={
                    alarmsUsable === false
                      ? "neutral"
                      : "accent"
                  }
                  size="sm"
                  variant={
                    alarmsUsable === false || alarmArmedHere
                      ? "filled"
                      : "outline"
                  }
                  icon={
                    <Ionicons
                      name={alarmArmedHere ? "alarm" : "alarm-outline"}
                      size={14}
                      color={
                        alarmsUsable === false
                          ? colors.inkSecondary
                          : colors.accent
                      }
                    />
                  }
                  label={
                    alarmsUsable === false
                      ? t("cook.alarmChip", {
                          minutes: Math.round(alarmMinutes),
                        })
                      : alarmArmedHere
                        ? `${t("cook.alarmArmed")} · ${t("cook.alarmCancel")}`
                        : t("cook.alarmSet", {
                            minutes: Math.round(alarmMinutes),
                          })
                  }
                />
              </IconPressable>
            </View>
          ) : null}
        </View>
        {alarmMinutes != null && alarmMinutes > 0 && alarmsUsable === false ? (
          <Text style={styles.alarmNeedsApp}>{t("cook.alarmNeedsAppCaption")}</Text>
        ) : null}

        <ElapsedTimer
          cookStartAt={cookStartAt}
          pausedAt={pausedAt}
          pausedMsTotal={pausedMsTotal}
          running={status === "running"}
          timerStyle={styles.timer}
          color={timerColor}
        />
        <Text
          style={[
            styles.statusHint,
            step.step_type === "passive" && status === "running"
              ? { color: colors.success }
              : null,
          ]}
        >
          {step.step_type === "passive" && status === "running"
            ? t("cook.hintHandsOff")
            : statusHint}
        </Text>

        {/* Step pace bar — the honest-time glance: teal fill toward this
            step's expected duration; amber + over-count once past it. */}
        {stepExpectedMs != null && status !== "idle" ? (
          <StepPaceBar
            running={status === "running"}
            frozenMs={stepFrozenMs}
            getElapsedMs={(nowMs) =>
              stepVisitElapsedMs(step.step_number, nowMs)
            }
            expectedMs={stepExpectedMs}
            wrapStyle={styles.stepPaceWrap}
            trackStyle={styles.stepTrack}
            fillStyle={styles.stepFill}
            fillOverStyle={styles.stepFillOver}
            textStyle={styles.stepPaceText}
            overColor={colors.amber}
            normalColor={colors.timing}
          />
        ) : null}

        <Card style={styles.descCard} padding={Space.xl} shadow="card">
          <Text style={styles.stepDescription}>
            {lr.stepDescription(step)}
          </Text>
        </Card>

        {/* Next-step preview — glance ahead while the pot simmers. */}
        {upcomingStep != null ? (
          <View style={styles.nextWrap}>
            <Text style={styles.nextLabel}>{t("cook.nextStep")}</Text>
            <Text style={styles.nextText} numberOfLines={2}>
              {lr.stepDescription(upcomingStep)}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer — ONE primary control per state. While cooking: circular
          step nav (⏮ / ⏭, ✓ on the last step = finish) flanking the big
          Pause/Resume pill; "Finish" stays available as a quiet row so you
          never have to page to the last step to end an early cook. */}
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
          <>
            <View style={styles.controlRow}>
              <IconPressable
                onPress={currentIndex === 0 ? undefined : prevStep}
                disabled={currentIndex === 0}
                accessibilityLabel={t("cook.previous")}
                style={[
                  styles.ctrlCircle,
                  currentIndex === 0 ? styles.ctrlCircleDisabled : null,
                ]}
              >
                <Ionicons
                  name={dir === "rtl" ? "chevron-forward" : "chevron-back"}
                  size={26}
                  color={colors.inkSecondary}
                />
              </IconPressable>

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

              <IconPressable
                onPress={onLastStep ? () => setConfirmFinish(true) : nextStep}
                accessibilityLabel={
                  onLastStep ? t("cook.finishCooking") : t("cook.next")
                }
                style={onLastStep ? styles.ctrlCircleDone : styles.ctrlCircle}
              >
                <Ionicons
                  name={onLastStep ? "checkmark" : dir === "rtl" ? "chevron-back" : "chevron-forward"}
                  size={onLastStep ? 26 : 26}
                  color={onLastStep ? "#FFFFFF" : colors.inkSecondary}
                />
              </IconPressable>
            </View>

            {!onLastStep ? (
              <Button
                title={t("cook.finishCooking")}
                variant="ghost"
                size="md"
                onPress={() => setConfirmFinish(true)}
                style={styles.finishRow}
              />
            ) : null}
          </>
        )}
      </View>

      {/* Finish confirmation — never end an active cook on a stray tap. */}
      <ActionSheet
        visible={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title={t("cook.finishTitle")}
        message={t("cook.finishMessage")}
        actions={[
          {
            key: "finish",
            label: t("cook.finishCooking"),
            icon: "checkmark-circle-outline",
            onPress: () => {
              setConfirmFinish(false);
              finishCooking();
            },
          },
        ]}
      />

      {/* Discard confirmation (✕ / hardware back on an active session). */}
      <ActionSheet
        visible={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title={t("cook.discardTitle")}
        message={t("cook.discardMessage")}
        actions={[
          {
            key: "discard",
            label: t("cook.discardBtn"),
            icon: "trash-outline",
            tone: "destructive",
            onPress: () => {
              setConfirmDiscard(false);
              // Discarded by the user: must not resurrect on next visit.
              clearPersistedSession();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(`/recipe/${id}`);
              }
            },
          },
        ]}
      />
    </View>
  );
}
