/**
 * Publisher-time fallbacks. Community timings are sparse for most of the
 * 520k-recipe library, so every place that reads a cook time for DISPLAY or
 * FILTERING must degrade to the publisher's claim instead of showing nothing.
 * Cleanup fields have NO publisher equivalent — they stay null (never forced
 * through these helpers).
 */
import type { Recipe, RecipeStep } from "@/types";

/**
 * Best-known total cook minutes: community consensus, else the publisher
 * claim. Accepts null (no recipe loaded yet) for the distribution helpers.
 * Used for FILTERING and sorting (mirrors the server's COALESCE over the
 * same two columns, so client and server filter semantics stay identical).
 */
export function recipeMinutes(recipe: Recipe | null): number | null {
  return recipe?.community_avg_minutes ?? recipe?.publisher_time_minutes ?? null;
}

/**
 * Best-known total cook minutes for DISPLAY: the Reality Index figure when
 * the backend maintains one (real cook sessions or an AI estimate), else the
 * community consensus, else the publisher claim. This is the single "what
 * does this recipe really take?" number every card and stat leads with, so
 * lists and the detail screen can never contradict each other again.
 */
export function bestMinutes(recipe: Recipe | null): number | null {
  return recipe?.reality?.minutes ?? recipeMinutes(recipe);
}

/** Best-known minutes for a single step: community, else the publisher. */
export function stepMinutes(step: RecipeStep): number | null {
  return step.community_minutes ?? step.publisher_minutes ?? null;
}

/** Flat per-step fallback when even the recipe has no total to distribute. */
const NO_TOTAL_STEP_MINUTES = 3;

/** Whitespace-separated word count of a step description (never negative). */
function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Memoized untimed-step distributions, keyed by the steps array identity and
 * validated against the recipe identity — the array + recipe pair a screen
 * renders with is stable across re-renders, so the O(n) distribution runs once
 * per recipe load instead of once per `estimateStepMinutes` call.
 */
const distributionCache = new WeakMap<
  RecipeStep[],
  { recipe: Recipe | null; map: Map<RecipeStep, number> }
>();

/**
 * Distribute the recipe's best-known DISPLAY total across the steps that lack
 * a per-step time: timed steps keep (and subtract) their own minutes, each
 * untimed step gets `pool * (wordCount / totalWordCount)` rounded to whole
 * minutes with a floor of 1. With no recipe total at all, every untimed step
 * falls back to NO_TOTAL_STEP_MINUTES. Pooling from bestMinutes keeps the
 * timeline walk adding back up to the "Really takes" stat the screen leads
 * with.
 */
function computeUntimedDistribution(
  recipe: Recipe | null,
  steps: RecipeStep[],
): Map<RecipeStep, number> {
  const map = new Map<RecipeStep, number>();
  const untimed: { step: RecipeStep; weight: number }[] = [];
  let timedSum = 0;
  for (const step of steps) {
    const own = stepMinutes(step);
    if (own != null) {
      timedSum += own;
    } else {
      untimed.push({ step, weight: Math.max(1, wordCount(step.description)) });
    }
  }
  const total = bestMinutes(recipe);
  if (total != null && untimed.length > 0) {
    // Timed steps are subtracted from the pool first; clamp at 0 so a pool
    // already consumed by timed steps still leaves each step the 1-min floor.
    const pool = Math.max(0, total - timedSum);
    const totalWeight = untimed.reduce((sum, u) => sum + u.weight, 0);
    for (const u of untimed) {
      map.set(u.step, Math.max(1, Math.round((pool * u.weight) / totalWeight)));
    }
  } else {
    for (const u of untimed) {
      map.set(u.step, NO_TOTAL_STEP_MINUTES);
    }
  }
  return map;
}

/**
 * Best-known minutes for a single step for DISPLAY and SCHEDULING: the step's
 * own community/publisher figure when present, otherwise its share of the
 * recipe's total (weighted by description length) so a 60-minute 6-step recipe
 * shows ~10-minute steps instead of a flat "~3 min", and the step timeline
 * adds back up to the recipe's stated total by construction. Always >= 1.
 */
export function estimateStepMinutes(
  step: RecipeStep,
  recipe: Recipe | null,
  steps: RecipeStep[],
): number {
  const own = stepMinutes(step);
  if (own != null) return own;
  let entry = distributionCache.get(steps);
  if (!entry || entry.recipe !== recipe) {
    entry = { recipe, map: computeUntimedDistribution(recipe, steps) };
    distributionCache.set(steps, entry);
  }
  return entry.map.get(step) ?? NO_TOTAL_STEP_MINUTES;
}
