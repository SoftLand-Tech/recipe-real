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

import { getRecipe } from "@/api/client";
import { getCachedRecipe } from "@/db/database";
import type { Recipe, RecipeStep } from "@/types";

type LoadState = "loading" | "ready" | "error";

/** Rounds a nullable minute value, returning null when absent. */
function roundMin(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Math.round(value);
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

  const publisher = roundMin(recipe?.publisher_time_minutes);
  const community = roundMin(recipe?.community_avg_minutes);
  const cleanup = roundMin(recipe?.cleanup_avg_minutes);

  const totalInclCleanup =
    community != null && cleanup != null ? community + cleanup : null;

  const steps: RecipeStep[] = recipe?.recipe_steps ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 16, paddingBottom: insets.bottom + 32 },
      ]}
    >
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
            <Text style={styles.summaryTotal}>
              Total incl. cleanup: {totalInclCleanup ?? "—"} min
            </Text>
            {cleanup != null ? (
              <Text style={styles.mutedSmall}>
                Cleanup avg: {cleanup} min
              </Text>
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
              {steps.map((step) => (
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
                  <Text style={styles.stepDescription}>
                    {step.description}
                  </Text>
                </View>
              ))}
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
  summaryTotal: {
    fontSize: 16,
    color: "#2563EB",
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
