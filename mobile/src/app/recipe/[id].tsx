import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getRecipe, hasToken } from "@/api/client";
import { getCachedRecipe, refreshPaceCalibrations } from "@/db/database";
import type { CleanupFactors, PaceCalibration, Recipe, RecipeStep } from "@/types";

type LoadState = "loading" | "ready" | "error";

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

function StepBadge({ stepType }: { stepType: string }) {
  const label = stepType && stepType.length > 0 ? stepType : "prep";
  return (
    <View style={[styles.badge, badgeColor(label)]}>
      <Text style={styles.badgeText}>{label.toUpperCase()}</Text>
    </View>
  );
}

function badgeColor(stepType: string) {
  switch (stepType) {
    case "cook":
      return { backgroundColor: "#FEF3C7" };
    case "cleanup":
      return { backgroundColor: "#E0E7FF" };
    case "prep":
    default:
      return { backgroundColor: "#DCFCE7" };
  }
}

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [calibrations, setCalibrations] = useState<PaceCalibration[]>([]);

  const loadRecipe = useCallback(async () => {
    setState("loading");
    setErrorMessage(null);
    try {
      const numericId = Number(id);
      let result = await getCachedRecipe(numericId);
      if (!result) {
        // Not in cache: fall back to a live fetch.
        result = await getRecipe(id);
      }
      setRecipe(result);
      setState("ready");
    } catch (error) {
      console.warn("[RecipeReal] loadRecipe failed:", error);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
      {/* Centered, max-width column so the screen reads cleanly on tablets. */}
      <View style={styles.columnWrap}>
      {state === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
          <Text style={styles.muted}>Loading recipe…</Text>
        </View>
      )}

      {state === "error" && (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.muted}>
            {errorMessage ?? "Could not load this recipe."}
          </Text>
          <Pressable style={styles.button} onPress={loadRecipe}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {state === "ready" && recipe && (
        <View style={styles.section}>
          <Text style={styles.title}>{recipe.title}</Text>

          {recipe.source_url ? (
            <Text style={styles.source} numberOfLines={1}>
              {recipe.source_url}
            </Text>
          ) : null}

          {/* Cook-time summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLine}>
              Publisher says {publisher ?? "—"} min · home cooks average{" "}
              {community ?? "—"} min
            </Text>
            <Text style={styles.breakdownLine}>
              Focused: {community ?? "—"} min · Cleanup: {cleanup ?? "—"} min ·
              Total: {totalInclCleanup ?? "—"} min
            </Text>
            <Text style={styles.summaryTotal}>
              Total incl. cleanup: {totalInclCleanup ?? "—"} min
            </Text>
            {personalTotal != null ? (
              <Text style={styles.paceLine}>
                Your pace: ~{personalTotal} min
              </Text>
            ) : null}
            {cleanupAvg != null ? (
              <Text style={styles.mutedSmall}>
                Cleanup avg: {cleanupAvg} min
              </Text>
            ) : null}
            {chips.length > 0 ? (
              <View style={styles.chipRow}>
                {chips.map((label) => (
                  <View key={label} style={styles.chip}>
                    <Text style={styles.chipText}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {/* Ingredients */}
          <Text style={styles.sectionHeading}>Ingredients</Text>
          {recipe.ingredients.length > 0 ? (
            <View style={styles.list}>
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

          {/* Steps */}
          <Text style={styles.sectionHeading}>Steps</Text>
          {steps.length > 0 ? (
            <View style={styles.list}>
              {steps.map((step) => {
                const adjusted = adjustedForStep(step);
                return (
                  <View key={`step-${step.id}`} style={styles.stepRow}>
                    <View style={styles.stepHeader}>
                      <Text style={styles.stepNumber}>#{step.step_number}</Text>
                      <StepBadge stepType={step.step_type} />
                      <Text style={styles.stepTime}>
                        {step.community_minutes != null
                          ? `${Math.round(step.community_minutes)} min`
                          : ""}
                      </Text>
                    </View>
                    {adjusted != null ? (
                      <Text style={styles.stepAdjusted}>
                        ~{adjusted} min (you)
                      </Text>
                    ) : null}
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.list}>
              {recipe.steps.map((step, idx) => (
                <View key={`plain-step-${idx}`} style={styles.bulletRow}>
                  <Text style={styles.bullet}>{idx + 1}.</Text>
                  <Text style={styles.bulletText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Cook Mode placeholder (Week 2) */}
          <Pressable
            style={({ pressed }) => [
              styles.cookButton,
              pressed && styles.cookButtonPressed,
            ]}
            onPress={() => router.push(`/cook/${id}`)}
          >
            <Text style={styles.cookButtonText}>Start Cook Mode</Text>
          </Pressable>
        </View>
      )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 16,
  },
  columnWrap: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  section: {
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
  },
  source: {
    fontSize: 13,
    color: "#6B7280",
  },
  summaryCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  summaryLine: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  breakdownLine: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "600",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  chip: {
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
  summaryTotal: {
    fontSize: 16,
    color: "#2563EB",
    fontWeight: "700",
  },
  paceLine: {
    fontSize: 15,
    color: "#7C3AED",
    fontWeight: "700",
  },
  mutedSmall: {
    fontSize: 12,
    color: "#6B7280",
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111827",
    marginTop: 8,
  },
  list: {
    gap: 8,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  bullet: {
    fontSize: 15,
    color: "#9CA3AF",
    lineHeight: 21,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 21,
  },
  stepRow: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
  stepTime: {
    marginLeft: "auto",
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "600",
  },
  stepAdjusted: {
    alignSelf: "flex-end",
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "600",
  },
  stepDescription: {
    fontSize: 15,
    color: "#111827",
    lineHeight: 21,
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
  cookButton: {
    marginTop: 8,
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cookButtonPressed: {
    backgroundColor: "#1D4ED8",
  },
  cookButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 64,
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
});
