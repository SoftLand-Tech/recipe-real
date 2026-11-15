/**
 * Cook Mode + recipe-detail API (slice RECIPE).
 *
 * Ports the RECIPE-relevant surface of mobile/src/api/http.ts + client.ts:
 *   - normalizeRecipe / normalizeStep / normalizePaceCalibration — Laravel
 *     serializes decimal columns as strings ("24.00"); every numeric field is
 *     coerced here so downstream arithmetic never string-concatenates. The
 *     Arabic json columns (ingredients_ar/steps_ar) may arrive as raw JSON
 *     strings and are parsed here, exactly like mobile.
 *   - fetchRecipe — GET /api/recipes/{id} (public read).
 *   - fetchPaceCalibrations — GET /api/pace-calibrations (authed; a 401
 *     degrades silently to [] so public pages keep working signed-out).
 *   - submitCookSession — POST /api/cook-sessions with mobile's exact payload
 *     shape (idempotency_key + per-step timing_submissions).
 *   - submitQuickTime — POST /api/recipes/{id}/quick-time ("it actually took
 *     N min" contribution).
 *
 * This file deliberately does NOT own the shared axios instance (http.ts,
 * foundation) nor api/recipes.ts (BROWSE).
 */
import axios from "axios";

import { get, post } from "@/api/http";
import type {
  CleanupFactors,
  CookSessionPayload,
  PaceCalibration,
  Recipe,
  RecipeStep,
  RealityCheck,
} from "@/api/types";

/** Coerce a nullable decimal column (may serialize as string) to number|null. */
export const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

/** Normalize one step row (decimal minutes → numbers; description_ar nullable). */
export function normalizeStep(s: unknown): RecipeStep {
  const r = (s ?? {}) as Record<string, unknown>;
  return {
    ...r,
    description_ar: (r.description_ar as string | null | undefined) ?? null,
    publisher_minutes: toNum(r.publisher_minutes),
    community_minutes: toNum(r.community_minutes),
    literal_minutes: toNum(r.literal_minutes),
  } as RecipeStep;
}

/**
 * Parse an Arabic-content array field that may arrive as a raw JSON string
 * (how the API passes the DB json columns through) or an already-decoded
 * array. Anything else → null (English fallback). Port of mobile http.ts.
 */
function parseArArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    return raw.every((x) => typeof x === "string") ? raw : null;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trimStart();
    if (trimmed.charCodeAt(0) === 91 /* '[' */) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
          ? parsed
          : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Normalize the reality-check block defensively: decimals may serialize as
 * strings and a malformed/absent object must read as "unknown" (null) so the
 * badge simply stays hidden. Numeric holes collapse to 0 except gap_pct,
 * which keeps its null meaning ("no claim to compare against").
 */
function normalizeReality(v: unknown): RealityCheck | null {
  if (v == null || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return {
    minutes: toNum(r.minutes) ?? 0,
    source: r.source === "estimate" ? "estimate" : "community",
    samples: toNum(r.samples) ?? 0,
    claimed_minutes: toNum(r.claimed_minutes) ?? 0,
    gap_minutes: toNum(r.gap_minutes) ?? 0,
    gap_pct: toNum(r.gap_pct),
  };
}

/** Normalize one recipe row from the wire (port of mobile's normalizeRecipe). */
export function normalizeRecipe(raw: unknown): Recipe {
  const r = (raw ?? {}) as Record<string, unknown>;
  const factorsSrc = (r.cleanup_factors ?? null) as Record<string, unknown> | null;
  const cleanup_factors: CleanupFactors | undefined = factorsSrc
    ? {
        dish_count: toNum(factorsSrc.dish_count),
        grease_level:
          factorsSrc.grease_level == null ? null : String(factorsSrc.grease_level),
        dishwasher_safe:
          factorsSrc.dishwasher_safe == null ? null : !!factorsSrc.dishwasher_safe,
      }
    : undefined;
  return {
    ...r,
    // User-submitted recipes may be Arabic-only (title null): keep the type
    // non-optional by defaulting to "" — the localized getter falls back to
    // title_ar for display.
    title: (r.title as string | null | undefined) ?? "",
    image_url:
      r?.image_url && String(r.image_url).trim()
        ? String(r.image_url).trim()
        : null,
    owner_id: r?.owner_id == null ? null : Number(r.owner_id),
    source_type: r?.source_type != null ? String(r.source_type) : null,
    title_ar: (r.title_ar as string | null | undefined) ?? null,
    ingredients_ar: parseArArray(r?.ingredients_ar),
    steps_ar: parseArArray(r?.steps_ar),
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
    cleanup_estimate_minutes: toNum(r.cleanup_estimate_minutes),
    aggregated_rating: toNum(r?.aggregated_rating),
    review_count: toNum(r?.review_count),
    category: r?.category != null ? String(r.category) : null,
    keywords: Array.isArray(r?.keywords) ? r.keywords : null,
    description: (r.description as string | null | undefined) ?? null,
    calories: toNum(r?.calories),
    protein_g: toNum(r?.protein_g),
    fat_g: toNum(r?.fat_g),
    ...(cleanup_factors ? { cleanup_factors } : {}),
    reality: normalizeReality(r?.reality),
    recipe_steps: Array.isArray(r.recipe_steps)
      ? r.recipe_steps.map(normalizeStep)
      : r.recipe_steps,
  } as Recipe;
}

/**
 * GET /api/recipes/{id} — the detail payload (recipe_steps included).
 * A 404 (bad id / removed recipe) rejects as an axios error the caller turns
 * into a clean error state.
 */
export async function fetchRecipe(id: number | string): Promise<Recipe> {
  const payload = await get<{ data?: unknown } | null>(`/recipes/${id}`);
  const row = (payload as { data?: unknown } | null)?.data ?? payload;
  if (row == null || typeof row !== "object") {
    throw new Error("Recipe not found");
  }
  return normalizeRecipe(row);
}

/** Normalize one pace calibration row (decimals → numbers, safe defaults). */
export function normalizePaceCalibration(c: unknown): PaceCalibration {
  const r = (c ?? {}) as Record<string, unknown>;
  return {
    step_type: String(r.step_type),
    personal_avg_minutes: toNum(r.personal_avg_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    multiplier: toNum(r.multiplier) ?? 1,
    confidence: toNum(r.confidence) ?? 0,
  };
}

/**
 * GET /api/pace-calibrations (authed): the signed-in cook's per-step-type
 * multipliers. A 401 (signed out / token cleared by http.ts) degrades
 * silently to [] so public screens keep publisher estimates.
 */
export async function fetchPaceCalibrations(): Promise<PaceCalibration[]> {
  try {
    const payload = await get<{ data?: unknown }>("/pace-calibrations");
    const rows = payload?.data;
    return Array.isArray(rows) ? rows.map(normalizePaceCalibration) : [];
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return [];
    }
    throw error;
  }
}

/**
 * POST /api/cook-sessions — the completed-cook payload mobile sends, verbatim:
 * total minutes, cleanup minutes, optional feedback, one idempotency key per
 * session (so a retried POST never double-logs) and per-step timing
 * submissions (recipe_step_id + actual_minutes).
 */
export function submitCookSession(payload: CookSessionPayload): Promise<unknown> {
  return post("/cook-sessions", payload);
}

/** Honest-breakdown contribution for POST /api/recipes/{id}/quick-time. */
export interface QuickTimeBreakdown {
  /** Total time in minutes — required (1..1440). */
  minutes: number;
  /** Washing & cleanup in minutes (optional). */
  cleanup_minutes?: number;
  /** Hands-on time in minutes (optional; ≤ total enforced client-side). */
  hands_on_minutes?: number;
  /** Plates/servings made (optional, 1..50). */
  servings?: number;
}

/** Server response of the quick-time endpoint (averages may be strings). */
export interface QuickTimeResultFull {
  ok: boolean;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
}

/**
 * POST /api/recipes/{id}/quick-time (authed). Returns the server-recomputed
 * community averages; a 401 rejects (callers show a sign-in CTA — the auth
 * bookkeeping itself was already handled by http.ts).
 */
export async function submitQuickTime(
  recipeId: number,
  breakdown: QuickTimeBreakdown,
): Promise<QuickTimeResultFull> {
  const data = await post<Record<string, unknown>>(
    `/recipes/${recipeId}/quick-time`,
    breakdown,
  );
  return {
    ok: Boolean(data?.ok),
    community_avg_minutes: toNum(data?.community_avg_minutes),
    cleanup_avg_minutes: toNum(data?.cleanup_avg_minutes),
  };
}

/** Whether an API error was an auth failure (401) — drives sign-in UX only. */
export function isUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}
