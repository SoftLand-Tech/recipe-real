import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getRecipe, hasToken, isPaywallError } from "@/api/client";
import { track } from "@/analytics";
import { getCachedRecipe, refreshPaceCalibrations } from "@/db/database";
import type {
  CleanupFactors,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/types";
import { Color, MaxContentWidth, Radius, Shadow, Space, Type } from "@/theme";
import {
  Badge,
  Button,
  Card,
  Chip,
  HeroImage,
  SectionHeader,
  StatPill,
  TimeChip,
  fmtMinutes,
} from "@/components/ui";

type LoadState = "loading" | "ready" | "error" | "paywall";

/** Rounds a nullable minute value, returning null when absent. */
function roundMin(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value);
}

/** Capitalize the first letter (e.g. grease level "medium" -> "Medium"). */
function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Build the cleanup-burden chip labels from the factors object. Each entry is
 * only included when its underlying value is non-null.
 */
function cleanupChips(factors: CleanupFactors | undefined): string[] {
  if (!factors) return [];
  const chips: string[] = [];
  if (factors.dish_count != null) {
    chips.push(`${Math.round(factors.dish_count)} dishes`);
  }
  if (factors.grease_level) {
    chips.push(capitalize(factors.grease_level));
  }
  if (factors.dishwasher_safe != null) {
    chips.push(factors.dishwasher_safe ? "Dishwasher-safe" : "Hand-wash");
  }
  return chips;
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);

  // Mirror of `recipe` for use inside `loadRecipe`'s catch block without
  // forcing `recipe` into the callback's dependency array (which would
  // re-fire the load effect on every successful fetch -> infinite loop).
  const recipeRef = useRef<Recipe | null>(null);

  const loadRecipe = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    recipeRef.current = null;
    try {
      const numericId = Number(id);
      let result = await getCachedRecipe(numericId);
      if (!result) {
        // Not in cache: fall back to a live fetch.
        result = await getRecipe(id);
      }
      setRecipe(result);
      recipeRef.current = result;
      setState("ready");
      // Fire-and-forget analytics once the recipe is successfully loaded.
      track("recipe_viewed", { recipe_id: result.id });
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
        error instanceof Error ? error.message : "Failed to load recipe.",
      );
      setState("error");
    }
  }, [id]);

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

  const publisher = roundMin(recipe?.publisher_time_minutes);
  const community = roundMin(recipe?.community_avg_minutes);
  const cleanupAvg = roundMin(recipe?.cleanup_avg_minutes);
  const cleanupEstimate = roundMin(recipe?.cleanup_estimate_minutes);
  // Prefer the model-based cleanup estimate, fall back to community average.
  const cleanup = cleanupEstimate ?? cleanupAvg;

  const totalInclCleanup =
    community != null && cleanup != null ? community + cleanup : null;

  const chips = recipe ? cleanupChips(recipe.cleanup_factors) : [];

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
      if (step.community_minutes == null) continue;
      const mult = paceMap.get(step.step_type) ?? 1;
      sum += step.community_minutes * mult;
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

  const ready = state === "ready" && recipe;

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
              <ActivityIndicator size="large" color={Color.accent} />
              <Text style={styles.muted}>Loading recipe…</Text>
            </View>
          )}

          {state === "error" && (
            <View style={styles.center}>
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.muted}>
                {errorMessage ?? "Could not load this recipe."}
              </Text>
              <Pressable style={styles.retry} onPress={loadRecipe}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {state === "paywall" && (
            <View style={styles.center}>
              <Text style={styles.paywallTitle}>Free limit reached</Text>
              <Text style={styles.muted}>
                You've reached the free limit (5 recipes/month). Upgrade for
                unlimited recipes.
              </Text>
              <Pressable
                style={styles.retry}
                onPress={() => router.push("/upgrade")}
              >
                <Text style={styles.retryText}>Upgrade</Text>
              </Pressable>
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
                      {recipe.title}
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
              <Pressable
                style={[
                  styles.backButton,
                  { top: insets.top + Space.sm },
                ]}
                onPress={() => router.back()}
                accessibilityLabel="Go back"
                accessibilityRole="button"
                hitSlop={Space.sm}
              >
                <Text style={styles.backGlyph}>‹</Text>
              </Pressable>

              {/* RISING CONTENT CARD overlapping the hero. */}
              <View style={styles.contentCard}>
                {/* 1. STAT GRID */}
                <View style={styles.statGrid}>
                  <View style={styles.statCell}>
                    <StatPill
                      label="Publisher"
                      value={fmtMinutes(publisher ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    <StatPill
                      label="Focused"
                      value={fmtMinutes(community ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    <StatPill
                      label="Cleanup"
                      value={fmtMinutes(cleanupAvg ?? 0)}
                    />
                  </View>
                  <View style={styles.statCell}>
                    <StatPill
                      label="Total incl. cleanup"
                      value={fmtMinutes(totalInclCleanup ?? 0)}
                      tone="accent"
                    />
                  </View>
                </View>

                {/* 2. YOUR PACE */}
                {personalTotal != null ? (
                  <View style={styles.paceRow}>
                    <Chip
                      tone="accent"
                      label={`Your pace · ~${fmtMinutes(personalTotal)}`}
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

                {/* 4. INGREDIENTS */}
                <View style={styles.section}>
                  <SectionHeader title="Ingredients" />
                  {recipe.ingredients.length > 0 ? (
                    <View style={styles.bulletList}>
                      {recipe.ingredients.map((ingredient, idx) => (
                        <View key={`ing-${idx}`} style={styles.bulletRow}>
                          <Text style={styles.bullet}>•</Text>
                          <Text style={styles.bulletText}>{ingredient}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.muted}>No ingredients listed.</Text>
                  )}
                </View>

                {/* 5. STEPS */}
                <View style={styles.section}>
                  <SectionHeader title="Steps" />
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
                                label={step.step_type}
                                stepType={step.step_type}
                              />
                              <View style={styles.stepTime}>
                                <TimeChip minutes={step.community_minutes} />
                              </View>
                            </View>
                            {adjusted != null ? (
                              <View style={styles.stepAdjustedRow}>
                                <Chip
                                  tone="accent"
                                  label={`~${fmtMinutes(adjusted)} you`}
                                  size="sm"
                                />
                              </View>
                            ) : null}
                            <Text style={styles.stepDescription}>
                              {step.description}
                            </Text>
                          </Card>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.stepList}>
                      {recipe.steps.map((step, idx) => (
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
            title="Start Cook Mode"
            onPress={() => router.push(`/cook/${id}`)}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    position: "relative",
    backgroundColor: Color.canvas,
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
    color: Color.surface,
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
    left: Space.lg,
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  backGlyph: {
    color: Color.surface,
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 28,
    marginTop: -2,
  },
  contentCard: {
    backgroundColor: Color.surface,
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
    color: Color.accent,
    lineHeight: 22,
    fontWeight: "700",
  },
  bulletText: {
    flex: 1,
    ...Type.body,
    color: Color.ink,
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
    backgroundColor: Color.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: Color.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  stepTime: {
    marginLeft: "auto",
  },
  stepAdjustedRow: {
    marginBottom: Space.sm,
  },
  stepDescription: {
    ...Type.body,
    color: Color.ink,
  },
  cookFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Color.surface,
    borderTopWidth: 1,
    borderTopColor: Color.hairline,
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
    color: Color.inkSecondary,
    textAlign: "center",
  },
  errorTitle: {
    ...Type.h3,
    color: Color.danger,
  },
  paywallTitle: {
    ...Type.h3,
    color: Color.accent,
  },
  retry: {
    marginTop: Space.sm,
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Color.accent,
  },
  retryText: {
    color: Color.surface,
    fontWeight: "700",
  },
});
