import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  getRecipe,
  hasToken,
  isPaywallError,
  QuickTimeUnauthorizedError,
  submitQuickTime,
} from "@/api/client";
import { track } from "@/analytics";
import {
  getCachedRecipe,
  getNote,
  isFavorite,
  refreshPaceCalibrations,
  saveNote,
  toggleFavorite,
  upsertRecipes,
} from "@/db/database";
import type {
  CleanupFactors,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/types";
import {
  MaxContentWidth,
  Radius,
  Shadow,
  Space,
  Type,
  useThemeColors,
} from "@/theme";
import {
  greaseLevelLabel,
  stepTypeLabel,
  useFmtMinutes,
  useLang,
  useLocalizedRecipe,
  useT,
  type TranslateFn,
} from "@/i18n";
import {
  Badge,
  Button,
  Card,
  Chip,
  HeroImage,
  IconPressable,
  SectionHeader,
  StatPill,
  TimeChip,
} from "@/components/ui";
import { recipeMinutes, stepMinutes } from "@/utils/recipeTime";

type LoadState = "loading" | "ready" | "error" | "paywall";

/** Rounds a nullable minute value, returning null when absent. */
function roundMin(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value);
}

/** Formats a Date as a short local clock string, e.g. "7:04 PM". */
function formatClock(date: Date): string {
  try {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    // Intl unavailable: manual 12-hour fallback so the clock never crashes.
    const hours = date.getHours();
    const h = hours % 12 || 12;
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m} ${hours < 12 ? "AM" : "PM"}`;
  }
}

/**
 * Build the cleanup-burden chip labels from the factors object. Each entry is
 * only included when its underlying value is non-null.
 */
function cleanupChips(
  t: TranslateFn,
  factors: CleanupFactors | undefined,
): string[] {
  if (!factors) return [];
  const chips: string[] = [];
  if (factors.dish_count != null) {
    chips.push(t("detail.dishes", { n: Math.round(factors.dish_count) }));
  }
  if (factors.grease_level) {
    chips.push(greaseLevelLabel(t, factors.grease_level));
  }
  if (factors.dishwasher_safe != null) {
    chips.push(
      factors.dishwasher_safe
        ? t("detail.dishwasherSafe")
        : t("detail.handWash"),
    );
  }
  return chips;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const t = useT();
  const { dir } = useLang();
  const fmtMin = useFmtMinutes();
  const lr = useLocalizedRecipe();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);
  const [favorited, setFavorited] = useState(false);
  // Personal note (local-only): the current editor text, the last saved
  // baseline (to detect changes), and a short-lived "Saved ✓" flag.
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [noteJustSaved, setNoteJustSaved] = useState(false);

  // Quick-time contribution: one-tap "how long did it take?" submission.
  // Rendered for everyone; an unauthenticated submit surfaces the sign-in
  // CTA (the 401 is mapped to QuickTimeUnauthorizedError in the client).
  const [quickMinutes, setQuickMinutes] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [quickDone, setQuickDone] = useState(false);
  const [quickAvg, setQuickAvg] = useState<number | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [quickNeedsAuth, setQuickNeedsAuth] = useState(false);
  // Fade-in for the "Thanks! …" success line (native-driven opacity).
  const quickFadeRef = useRef(new Animated.Value(0));

  // Mirror of `recipe` for use inside `loadRecipe`'s catch block without
  // forcing `recipe` into the callback's dependency array (which would
  // re-fire the load effect on every successful fetch -> infinite loop).
  const recipeRef = useRef<Recipe | null>(null);

  // Hides the "Saved ✓" confirmation a few seconds after a successful save.
  const noteSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
    };
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          position: "relative",
          backgroundColor: colors.canvas,
        },
        scroll: {
          flex: 1,
        },
        content: {
          paddingHorizontal: 0,
        },
        columnWrap: {
          width: "100%",
          maxWidth: MaxContentWidth,
          alignSelf: "center",
        },
        heroWrap: {
          width: "100%",
        },
        heroOverlay: {
          paddingHorizontal: Space.lg,
        },
        heroTitle: {
          ...Type.h1,
          // Over a photo scrim — always white, never the theme surface color.
          color: "#FFFFFF",
          textShadowColor: "rgba(0,0,0,0.55)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 6,
        },
        heroSource: {
          ...Type.caption,
          color: "rgba(255,255,255,0.85)",
          marginTop: Space.xs,
        },
        backButton: {
          position: "absolute",
          // Physical left/right don't flip in RTL — pick the side per dir so
          // back stays at the reading-start edge, favorite at the far edge.
          ...(dir === "rtl" ? { right: Space.lg } : { left: Space.lg }),
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },
        backGlyph: {
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: "600",
          lineHeight: 28,
          marginTop: -2,
        },
        favButton: {
          position: "absolute",
          ...(dir === "rtl" ? { left: Space.lg } : { right: Space.lg }),
          width: 38,
          height: 38,
          borderRadius: Radius.pill,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        },
        contentCard: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: Radius.xl,
          borderTopRightRadius: Radius.xl,
          marginTop: -Space.huge,
          paddingHorizontal: Space.lg,
          paddingTop: Space.xl,
          paddingBottom: Space.huge,
        },
        statGrid: {
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -Space.sm,
          marginTop: -Space.sm,
        },
        statCell: {
          width: "50%",
          paddingHorizontal: Space.sm,
          paddingTop: Space.sm,
        },
        paceRow: {
          flexDirection: "row",
          marginTop: Space.lg,
        },
        chipRow: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: Space.xs,
          marginTop: Space.lg,
        },
        // ---- Quick-time contribution card ----
        quickCard: {
          marginTop: Space.lg,
          padding: Space.lg,
          gap: Space.xs,
        },
        quickCaption: {
          ...Type.overline,
          color: colors.inkSecondary,
          textTransform: "uppercase",
        },
        quickTitle: {
          ...Type.title,
          color: colors.ink,
        },
        quickRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          marginTop: Space.sm,
        },
        // flex on the wrapper row (never on the Button's Pressable itself —
        // Android paint rules); the input stretches to the remaining space.
        quickInputWrap: {
          flexGrow: 1,
          flexBasis: 0,
        },
        quickInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          paddingVertical: Space.md,
          paddingHorizontal: Space.md,
        },
        quickError: {
          ...Type.caption,
          color: colors.danger,
          marginTop: Space.xs,
        },
        quickSuccess: {
          ...Type.bodySm,
          color: colors.success,
          fontWeight: "600",
          marginTop: Space.xs,
        },
        quickSignIn: {
          ...Type.caption,
          color: colors.accent,
          fontWeight: "700",
          marginTop: Space.xs,
          paddingVertical: Space.xs,
          alignSelf: "flex-start",
        },
        timelineHeadline: {
          ...Type.title,
          color: colors.ink,
        },
        timelineCleanupNote: {
          ...Type.caption,
          color: colors.inkSecondary,
          marginTop: Space.xs,
        },
        timelineStats: {
          flexDirection: "row",
          gap: Space.xl,
          marginTop: Space.md,
        },
        timelineList: {
          gap: Space.xs,
          marginTop: Space.md,
        },
        timelineRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          paddingHorizontal: Space.sm,
          paddingVertical: 6,
          borderRadius: Radius.md,
        },
        timelineRowPassive: {
          backgroundColor: colors.successSoft,
        },
        timelineClock: {
          ...Type.bodySm,
          color: colors.inkSecondary,
          fontVariant: ["tabular-nums"] as ("tabular-nums")[],
          fontWeight: "600",
          width: 64,
        },
        timelineDot: {
          width: 8,
          height: 8,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        timelineDotPassive: {
          backgroundColor: colors.success,
        },
        timelineInfo: {
          flex: 1,
        },
        timelineCaptionRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.xs,
        },
        timelineStepCaption: {
          ...Type.caption,
          color: colors.inkFaint,
          fontWeight: "600",
        },
        timelineChipWrap: {
          marginTop: -2,
        },
        timelineDesc: {
          ...Type.bodySm,
          color: colors.ink,
          marginTop: 1,
        },
        timelineDuration: {
          ...Type.caption,
          color: colors.inkSecondary,
          fontWeight: "600",
        },
        section: {
          marginTop: Space.xxl,
        },
        bulletList: {
          gap: Space.xs,
        },
        bulletRow: {
          flexDirection: "row",
          gap: Space.sm,
          alignItems: "flex-start",
        },
        bullet: {
          fontSize: Type.body.fontSize,
          color: colors.accent,
          lineHeight: 22,
          fontWeight: "700",
        },
        bulletText: {
          flex: 1,
          ...Type.body,
          color: colors.ink,
        },
        stepList: {
          gap: Space.md,
        },
        stepHeader: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.sm,
          marginBottom: Space.sm,
        },
        stepNumber: {
          width: 26,
          height: 26,
          borderRadius: Radius.pill,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
        },
        stepNumberText: {
          color: colors.accent,
          fontSize: 13,
          fontWeight: "700",
        },
        stepTime: {
          // Auto margin on the TRAILING physical side pushes the time chip to
          // the end of the row in both directions.
          ...(dir === "rtl" ? { marginRight: "auto" } : { marginLeft: "auto" }),
        },
        stepAdjustedRow: {
          marginBottom: Space.sm,
        },
        stepDescription: {
          ...Type.body,
          color: colors.ink,
        },
        noteInput: {
          ...Type.body,
          color: colors.ink,
          backgroundColor: colors.surfaceSoft,
          borderWidth: 1,
          borderColor: colors.hairline,
          borderRadius: Radius.md,
          padding: Space.md,
          minHeight: 90,
          textAlignVertical: "top",
        },
        noteActions: {
          flexDirection: "row",
          alignItems: "center",
          gap: Space.md,
          marginTop: Space.sm,
        },
        noteSaved: {
          ...Type.caption,
          color: colors.success,
          fontWeight: "600",
        },
        cookFooter: {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingHorizontal: Space.lg,
          paddingTop: Space.sm,
          ...Shadow.floating,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: Space.sm,
          paddingVertical: Space.mega,
          paddingHorizontal: Space.xxl,
        },
        muted: {
          ...Type.body,
          color: colors.inkSecondary,
          textAlign: "center",
        },
        errorTitle: {
          ...Type.h3,
          color: colors.danger,
        },
        paywallTitle: {
          ...Type.h3,
          color: colors.accent,
        },
        retry: {
          marginTop: Space.sm,
          paddingHorizontal: Space.xl,
          paddingVertical: Space.md,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
        },
        retryText: {
          color: colors.surface,
          fontWeight: "700",
        },
      }),
    [colors, dir],
  );

  const loadRecipe = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    recipeRef.current = null;
    // Reset the quick-time contribution state for the (new) recipe.
    setQuickMinutes("");
    setQuickSubmitting(false);
    setQuickDone(false);
    setQuickAvg(null);
    setQuickError(null);
    setQuickNeedsAuth(false);
    quickFadeRef.current.setValue(0);
    try {
      const numericId = Number(id);
      let result = await getCachedRecipe(numericId);
      if (!result || (result.recipe_steps?.length ?? 0) === 0) {
        // Not in cache OR cached copy lost its steps (damaged cache): fetch
        // live and re-cache so the step library self-heals recipe by recipe.
        try {
          const fetched = await getRecipe(id);
          if (fetched.recipe_steps?.length) {
            upsertRecipes([fetched], { withSteps: true }).catch(() => {});
          }
          result = fetched;
        } catch (error) {
          // Network failed. When a cached copy exists, show it anyway;
          // otherwise surface the original error (incl. 402 paywall).
          if (!result) throw error;
        }
      }
      setRecipe(result);
      recipeRef.current = result;
      setState("ready");
      // Fire-and-forget analytics once the recipe is successfully loaded.
      track("recipe_viewed", { recipe_id: result.id });
      // Best-effort: seed the favorite state from local storage (never blocks).
      isFavorite(numericId)
        .then(setFavorited)
        .catch(() => {});
    } catch (error) {
      console.warn("[RecipeReal] loadRecipe failed:", error);
      // A 402 means the free-tier recipe limit is reached. Only surface the
      // paywall when we have no cached copy to fall back on; the cache path
      // above would have resolved before reaching the network fetch.
      if (recipeRef.current == null && isPaywallError(error)) {
        setState("paywall");
        return;
      }
      setErrorMessage(
        error instanceof Error ? error.message : t("common.loadFailedRecipe"),
      );
      setState("error");
    }
  }, [id, t]);

  useEffect(() => {
    loadRecipe();
  }, [loadRecipe]);

  // Best-effort: load personalized pace multipliers after the recipe renders.
  // Only when authenticated; never blocks the recipe view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!(await hasToken())) return;
      try {
        const items = await refreshPaceCalibrations();
        if (!cancelled) setCalibrations(items);
      } catch (error) {
        console.warn("[RecipeReal] pace load failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Toggles the favorite state; storage failures are silently ignored. */
  const onToggleFavorite = useCallback(async () => {
    try {
      const now = await toggleFavorite(Number(id));
      setFavorited(now);
      track("favorite_toggled", {
        recipe_id: Number(id),
        favorited: now,
      });
    } catch {
      // Favorites are best-effort; never crash the detail screen.
    }
  }, [id]);

  /** Saves the personal note locally, then flashes a "Saved ✓" confirmation. */
  const onSaveNote = useCallback(async () => {
    try {
      await saveNote(Number(id), note);
      setSavedNote(note);
      track("note_saved", { recipe_id: Number(id) });
      setNoteJustSaved(true);
      if (noteSavedTimerRef.current) clearTimeout(noteSavedTimerRef.current);
      noteSavedTimerRef.current = setTimeout(() => {
        setNoteJustSaved(false);
      }, 3000);
    } catch {
      // Notes are best-effort; never crash the detail screen.
    }
  }, [id, note]);

  /**
   * Submit the quick-time contribution (1..1440 minutes). Success swaps the
   * form for a faded-in "Thanks! Community avg is now ~Xm" line using the
   * server-recomputed average. A 401 shows the sign-in CTA instead; any
   * other failure shows an inline error and keeps the form usable.
   */
  const onSubmitQuickTime = useCallback(async () => {
    const minutes = Number.parseInt(quickMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 1440) return;
    const recipeId = Number(id);
    if (!Number.isFinite(recipeId)) return;
    setQuickSubmitting(true);
    setQuickError(null);
    setQuickNeedsAuth(false);
    try {
      const result = await submitQuickTime(recipeId, minutes);
      track("quick_time_submitted", { recipe_id: recipeId, minutes });
      setQuickAvg(result.community_avg_minutes);
      setQuickDone(true);
      quickFadeRef.current.setValue(0);
      Animated.timing(quickFadeRef.current, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.warn("[RecipeReal] quick-time submit failed:", error);
      if (error instanceof QuickTimeUnauthorizedError) {
        setQuickNeedsAuth(true);
        setQuickError(t("quick.signInRequired"));
      } else {
        setQuickError(t("quick.error"));
      }
    } finally {
      setQuickSubmitting(false);
    }
  }, [quickMinutes, id, t]);

  /** Parsed quick-time minutes, valid only within 1..1440. */
  const quickMinutesValue = Number.parseInt(quickMinutes, 10);
  const quickMinutesValid =
    Number.isFinite(quickMinutesValue) &&
    quickMinutesValue >= 1 &&
    quickMinutesValue <= 1440;

  const publisher = roundMin(recipe?.publisher_time_minutes);
  const community = roundMin(recipe?.community_avg_minutes);
  const cleanupAvg = roundMin(recipe?.cleanup_avg_minutes);
  const cleanupEstimate = roundMin(recipe?.cleanup_estimate_minutes);
  // Prefer the model-based cleanup estimate, fall back to community average.
  const cleanup = cleanupEstimate ?? cleanupAvg;
  // Best-known cook time: community consensus, else the publisher claim, so
  // sparse community data never blanks the cook-time stat (the label below
  // distinguishes "Real avg" from a "Publisher" fallback).
  const cookMinutes = roundMin(recipe ? recipeMinutes(recipe) : null);

  const totalInclCleanup =
    cookMinutes != null && cleanup != null ? cookMinutes + cleanup : null;

  const chips = recipe ? cleanupChips(t, recipe.cleanup_factors) : [];

  const steps: RecipeStep[] = recipe?.recipe_steps ?? [];

  // Build a step_type -> multiplier map and compute the personalized estimate.
  const paceMap = new Map<string, number>();
  for (const c of calibrations) paceMap.set(c.step_type, c.multiplier);

  /**
   * Personalized total: sum each non-cleanup step's community minutes scaled
   * by its multiplier, plus the recipe-level cleanup_avg scaled if a cleanup
   * calibration exists. Falls back to the raw community value (multiplier 1)
   * when no calibration is present.
   */
  let personalTotal: number | null = null;
  if (calibrations.length > 0 && recipe) {
    let sum = 0;
    let hasAny = false;
    for (const step of steps) {
      if (step.step_type === "cleanup") continue;
      // Per-step publisher fallback: a missing community figure alone must
      // not drop the step from the personalized estimate.
      const stepM = stepMinutes(step);
      if (stepM == null) continue;
      const mult = paceMap.get(step.step_type) ?? 1;
      sum += stepM * mult;
      hasAny = true;
    }
    if (recipe.cleanup_avg_minutes != null) {
      const cleanupMult = paceMap.get("cleanup");
      sum += recipe.cleanup_avg_minutes * (cleanupMult ?? 1);
      hasAny = true;
    }
    if (hasAny) personalTotal = Math.round(sum);
  }

  /** Adjusted minutes for a single step (null when no calibration applies). */
  function adjustedForStep(step: RecipeStep): number | null {
    if (step.community_minutes == null) return null;
    const mult = paceMap.get(step.step_type);
    if (mult == null || mult === 1) return null;
    return Math.round(step.community_minutes * mult);
  }

  /**
   * Effective minutes used by the "When's dinner ready?" timeline: the
   * pace-adjusted value when a calibration applies, else the community or
   * publisher figure, else a quiet 3-minute default.
   */
  function minutesForStep(step: RecipeStep): number {
    return (
      adjustedForStep(step) ?? step.community_minutes ?? step.publisher_minutes ?? 3
    );
  }

  // Timeline: cooking steps only — cleanup is quoted separately (you eat first).
  const timelineSteps = steps.filter((s) => s.step_type !== "cleanup");
  let focusedTotal = 0;
  let handsOffTotal = 0;
  let cookTotal = 0;
  const timelineRows: { step: RecipeStep; at: Date; minutes: number }[] = [];
  let cursor = Date.now();
  for (const step of timelineSteps) {
    const minutes = minutesForStep(step);
    timelineRows.push({ step, at: new Date(cursor), minutes });
    cursor += minutes * 60000;
    cookTotal += minutes;
    if (step.step_type === "passive") handsOffTotal += minutes;
    else focusedTotal += minutes;
  }
  // "Start now" eat time — cleanup is intentionally excluded from the walk.
  const eatAt = new Date(cursor);

  const ready = state === "ready" && recipe;

  // The note text differs from the last saved baseline -> the Save button is
  // enabled and styled as primary; otherwise ghost + disabled.
  const noteDirty = note !== savedNote;

  // Fire the timeline analytics event once, when the section first renders.
  const timelineTrackedRef = useRef(false);
  useEffect(() => {
    if (!ready || timelineTrackedRef.current) return;
    if (steps.length === 0) return;
    timelineTrackedRef.current = true;
    track("timeline_viewed", { recipe_id: Number(id) });
  }, [ready, steps.length, id]);

  // Best-effort: load the personal note once the recipe is ready (local-only).
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    getNote(Number(id))
      .then((stored) => {
        if (cancelled) return;
        setSavedNote(stored ?? "");
        setNote(stored ?? "");
      })
      .catch(() => {
        // Notes are best-effort; never block the detail screen.
      });
    return () => {
      cancelled = true;
    };
  }, [ready, id]);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: 120 }]}
      >
        {/* Centered, max-width column so the screen reads cleanly on tablets. */}
        <View style={styles.columnWrap}>
          {state === "loading" && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={styles.muted}>{t("common.loadingRecipe")}</Text>
            </View>
          )}

          {state === "error" && (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>
                {t("common.somethingWentWrong")}
              </Text>
              <Text style={styles.muted}>
                {errorMessage ?? t("common.couldNotLoadRecipe")}
              </Text>
              <IconPressable style={styles.retry} onPress={loadRecipe}>
                <Text style={styles.retryText}>{t("common.retry")}</Text>
              </IconPressable>
            </View>
          )}

          {state === "paywall" && (
            <View style={styles.center}>
              <Text style={styles.paywallTitle}>
                {t("detail.freeLimitTitle")}
              </Text>
              <Text style={styles.muted}>{t("detail.freeLimitBody")}</Text>
              <IconPressable
                style={styles.retry}
                onPress={() => router.push("/upgrade")}
              >
                <Text style={styles.retryText}>{t("common.upgrade")}</Text>
              </IconPressable>
            </View>
          )}

          {ready && (
            <>
                {/* HERO — full-bleed, ignores side padding. */}
                <View style={styles.heroWrap}>
                  <HeroImage
                    uri={recipe.image_url}
                    height={340}
                    withScrim
                    rounded={0}
                  >
                  <View
                    style={[
                      styles.heroOverlay,
                      {
                        paddingBottom: Space.xl,
                        paddingTop: insets.top + Space.huge,
                      },
                    ]}
                  >
                    <Text style={styles.heroTitle} numberOfLines={3}>
                      {lr.title(recipe)}
                    </Text>
                    {recipe.source_url ? (
                      <Text style={styles.heroSource} numberOfLines={1}>
                        {recipe.source_url}
                      </Text>
                    ) : null}
                  </View>
                </HeroImage>
              </View>

              {/* Floating back button over the hero. */}
              <IconPressable
                style={[
                  styles.backButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={() => router.back()}
                hitSlop={Space.sm}
              >
                <Text style={styles.backGlyph}>{dir === "rtl" ? "›" : "‹"}</Text>
              </IconPressable>

              {/* Floating favorite toggle over the hero (mirrors the back button). */}
              <IconPressable
                style={[
                  styles.favButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={onToggleFavorite}
                hitSlop={Space.sm}
              >
                <Ionicons
                  name={favorited ? "heart" : "heart-outline"}
                  size={20}
                  color={favorited ? "#E8384F" : "#FFFFFF"}
                />
              </IconPressable>

              {/* RISING CONTENT CARD overlapping the hero. */}
              <View style={styles.contentCard}>
                {/* 1. STAT GRID */}
                <View style={styles.statGrid}>
                  <View style={styles.statCell}>
                    <StatPill
                      label={t("detail.statPublisher")}
                      value={fmtMin(publisher ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    {/* "Real avg" when the community consensus exists, else
                        the publisher claim relabeled as such — never a dash
                        when the publisher time is known. */}
                    <StatPill
                      label={
                        community != null
                          ? t("detail.statRealAvg")
                          : t("detail.statPublisher")
                      }
                      value={fmtMin(cookMinutes ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    <StatPill
                      label={t("common.cleanup")}
                      value={fmtMin(cleanupAvg ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    <StatPill
                      label={t("detail.statTotalInclCleanup")}
                      value={fmtMin(totalInclCleanup ?? 0)}
                      tone="accent"
                    />
                  </View>
                </View>

                {/* 1b. RATING — compact "★ rating (N)" line when known. */}
                {recipe.aggregated_rating != null ? (
                  <View style={styles.chipRow}>
                    <Chip
                      tone="amber"
                      size="sm"
                      label={
                        recipe.review_count != null && recipe.review_count > 0
                          ? t("detail.ratingWithCount", {
                              rating: recipe.aggregated_rating.toFixed(1),
                              n: recipe.review_count,
                            })
                          : t("detail.ratingOnly", {
                              rating: recipe.aggregated_rating.toFixed(1),
                            })
                      }
                    />
                  </View>
                ) : null}

                {/* 1c. QUICK-TIME CONTRIBUTION — "Cooked it? How long did it
                    take?" Rendered for everyone; unauthenticated submits
                    prompt sign-in (401 → QuickTimeUnauthorizedError). */}
                <Card style={styles.quickCard} padding={0}>
                  <Text style={styles.quickCaption}>{t("quick.cookedIt")}</Text>
                  <Text style={styles.quickTitle}>{t("quick.howLong")}</Text>
                  {quickDone ? (
                    <Animated.Text
                      style={[styles.quickSuccess, { opacity: quickFadeRef.current }]}
                    >
                      {t("quick.thanks", {
                        time: fmtMin(quickAvg ?? quickMinutesValue),
                      })}
                    </Animated.Text>
                  ) : (
                    <>
                      <View style={styles.quickRow}>
                        <View style={styles.quickInputWrap}>
                          <TextInput
                            style={styles.quickInput}
                            value={quickMinutes}
                            onChangeText={(text) =>
                              setQuickMinutes(text.replace(/[^0-9]/g, ""))
                            }
                            placeholder={t("quick.minutesPlaceholder")}
                            placeholderTextColor={colors.inkFaint}
                            keyboardType="number-pad"
                            maxLength={4}
                          />
                        </View>
                        <Button
                          title={t("quick.submit")}
                          variant="primary"
                          disabled={!quickMinutesValid}
                          loading={quickSubmitting}
                          onPress={onSubmitQuickTime}
                        />
                      </View>
                      {quickError != null ? (
                        <Text style={styles.quickError}>{quickError}</Text>
                      ) : null}
                      {quickNeedsAuth ? (
                        <Pressable
                          onPress={() => router.push("/login")}
                          hitSlop={Space.sm}
                          style={styles.quickSignIn}
                        >
                          <Text style={styles.quickSignIn}>
                            {t("quick.signIn")}
                          </Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </Card>

                {/* 2. YOUR PACE */}
                {personalTotal != null ? (
                  <View style={styles.paceRow}>
                    <Chip
                      tone="accent"
                      label={t("detail.yourPace", {
                        time: fmtMin(personalTotal),
                      })}
                    />
                  </View>
                ) : null}

                {/* 3. CLEANUP CHIPS */}
                {chips.length > 0 ? (
                  <View style={styles.chipRow}>
                    {chips.map((label) => (
                      <Chip key={label} tone="neutral" label={label} size="sm" />
                    ))}
                  </View>
                ) : null}

                {/* 4. WHEN'S DINNER READY? — start-now timeline. */}
                {steps.length > 0 ? (
                  <View style={styles.section}>
                    <SectionHeader title={t("detail.timelineTitle")} />
                    <Text style={styles.timelineHeadline} numberOfLines={1}>
                      {t("detail.startNow", { time: formatClock(eatAt) })}
                    </Text>
                    {cleanup != null && cleanup > 0 ? (
                      <Text style={styles.timelineCleanupNote}>
                        {t("detail.cleanupAfter", { time: fmtMin(cleanup) })}
                      </Text>
                    ) : null}
                    <View style={styles.timelineStats}>
                      <StatPill
                        label={t("common.focused")}
                        value={`~${fmtMin(focusedTotal)}`}
                      />
                      <StatPill
                        label={t("common.handsOff")}
                        value={`~${fmtMin(handsOffTotal)}`}
                      />
                      <StatPill
                        label={t("common.cleanup")}
                        value={`~${fmtMin(cleanup ?? 0)}`}
                      />
                    </View>
                    <View style={styles.timelineList}>
                      {timelineRows.map(({ step, at, minutes }) => {
                        const passive = step.step_type === "passive";
                        const hasMinutes =
                          step.community_minutes != null ||
                          step.publisher_minutes != null;
                        return (
                          <View
                            key={`tl-${step.id}`}
                            style={[
                              styles.timelineRow,
                              passive && styles.timelineRowPassive,
                            ]}
                          >
                            <Text style={styles.timelineClock}>
                              {formatClock(at)}
                            </Text>
                            <View
                              style={[
                                styles.timelineDot,
                                passive && styles.timelineDotPassive,
                              ]}
                            />
                            <View style={styles.timelineInfo}>
                              <View style={styles.timelineCaptionRow}>
                                <Text style={styles.timelineStepCaption}>
                                  {t("detail.stepCaption", {
                                    n: step.step_number,
                                  }) + (passive ? "" : ` ${t("detail.stepActive")}`)}
                                </Text>
                                {passive ? (
                                  <View style={styles.timelineChipWrap}>
                                    <Chip
                                      label={t("common.handsOff")}
                                      tone="success"
                                      size="sm"
                                    />
                                  </View>
                                ) : null}
                              </View>
                              <Text
                                style={styles.timelineDesc}
                                numberOfLines={1}
                              >
                                {lr.stepDescription(step)}
                              </Text>
                            </View>
                            {hasMinutes ? (
                              <Text
                                style={styles.timelineDuration}
                                numberOfLines={1}
                              >
                                {`~${fmtMin(minutes)}`}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}

                {/* 5. INGREDIENTS */}
                <View style={styles.section}>
                  <SectionHeader title={t("detail.ingredients")} />
                  {recipe.ingredients.length > 0 ? (
                    <View style={styles.bulletList}>
                      {lr.ingredients(recipe).map((ingredient, idx) => (
                        <View key={`ing-${idx}`} style={styles.bulletRow}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.bulletText}>{ingredient}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.muted}>{t("detail.noIngredients")}</Text>
                  )}
                </View>

                {/* 6. YOUR NOTES — personal tweaks, kept on this device. */}
                <View style={styles.section}>
                  <SectionHeader
                    title={t("detail.yourNotes")}
                    subtitle={t("detail.notesSubtitle")}
                  />
                  <TextInput
                    style={styles.noteInput}
                    value={note}
                    onChangeText={setNote}
                    placeholder={t("detail.notesPlaceholder")}
                    placeholderTextColor={colors.inkFaint}
                    multiline
                  />
                  <View style={styles.noteActions}>
                    <Button
                      variant={noteDirty ? "primary" : "ghost"}
                      disabled={!noteDirty}
                      title={t("detail.saveNote")}
                      onPress={onSaveNote}
                    />
                    {noteJustSaved ? (
                      <Text style={styles.noteSaved}>{t("detail.saved")}</Text>
                    ) : null}
                  </View>
                </View>

                {/* 7. STEPS */}
                <View style={styles.section}>
                  <SectionHeader title={t("detail.steps")} />
                  {steps.length > 0 ? (
                    <View style={styles.stepList}>
                      {steps.map((step) => {
                        const adjusted = adjustedForStep(step);
                        return (
                          <Card key={`step-${step.id}`} padding={Space.lg}>
                            <View style={styles.stepHeader}>
                              <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>
                                  {step.step_number}
                                </Text>
                              </View>
                              <Badge
                                label={stepTypeLabel(t, step.step_type)}
                                stepType={step.step_type}
                              />
                              <View style={styles.stepTime}>
                                <TimeChip minutes={stepMinutes(step)} />
                              </View>
                            </View>
                            {adjusted != null ? (
                              <View style={styles.stepAdjustedRow}>
                                <Chip
                                  tone="accent"
                                  label={t("detail.adjustedForYou", {
                                    time: fmtMin(adjusted),
                                  })}
                                  size="sm"
                                />
                              </View>
                            ) : null}
                            <Text style={styles.stepDescription}>
                              {lr.stepDescription(step)}
                            </Text>
                          </Card>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.stepList}>
                      {lr.steps(recipe).map((step, idx) => (
                        <Card key={`plain-step-${idx}`} padding={Space.lg}>
                          <View style={styles.bulletRow}>
                            <View style={styles.stepNumber}>
                              <Text style={styles.stepNumberText}>
                                {idx + 1}
                              </Text>
                            </View>
                            <Text style={styles.bulletText}>{step}</Text>
                          </View>
                        </Card>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Pinned footer: Cook Mode button stays visible regardless of scroll. */}
      {ready && (
        <View
          style={[
            styles.cookFooter,
            { paddingBottom: insets.bottom + Space.sm },
          ]}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            title={t("detail.startCookMode")}
            onPress={() => router.push(`/cook/${id}`)}
          />
        </View>
      )}
    </View>
  );
}
