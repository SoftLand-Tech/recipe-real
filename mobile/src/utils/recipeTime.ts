/**
 * Publisher-time fallbacks. Community timings are sparse for most of the
 * 520k-recipe library, so every place that reads a cook time for DISPLAY or
 * FILTERING must degrade to the publisher's claim instead of showing nothing.
 * Cleanup fields have NO publisher equivalent — they stay null (never forced
 * through these helpers).
 */
import type { Recipe, RecipeStep } from "@/types";

/** Best-known total cook minutes: community consensus, else the publisher claim. */
export function recipeMinutes(recipe: Recipe): number | null {
  return recipe.community_avg_minutes ?? recipe.publisher_time_minutes ?? null;
}

/** Best-known minutes for a single step: community, else the publisher. */
export function stepMinutes(step: RecipeStep): number | null {
  return step.community_minutes ?? step.publisher_minutes ?? null;
}
