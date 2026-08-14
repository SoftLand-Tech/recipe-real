import axios, { type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";
import type {
  CleanupFactors,
  PaceCalibration,
  Recipe,
  RecipeStep,
} from "@/types";

/**
 * A configured axios instance for the RecipeReal backend. Owned here so it can
 * be shared by both the API client and the offline-sync flush without creating
 * a circular import between `@/api/client` and `@/db/database`.
 */
export const http: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** Attach the bearer token from SecureStore to every request, if present. */
http.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * On a 401 response, clear the stored auth token (it is no longer valid).
 * We don't navigate anywhere yet (there is no auth screen); callers still see
 * the original error. The interceptor swallows its own failures so a buggy
 * clear never masks the real 401.
 */
http.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      } catch {
        // Swallow: don't let a failed clear mask the original 401.
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Raw POST to `/api/cook-sessions`. Throws on ANY failure (network or server).
 * Shared between `submitCookSession` (in the client) and
 * `flushPendingCookSessions` (in the db layer) so the flush doesn't re-trigger
 * the offline fallback (which would re-enqueue and loop).
 */
export async function postCookSessionRaw(payload: unknown): Promise<void> {
  await http.post("/api/cook-sessions", payload);
}

// ---- Normalizers & seed/pace fetchers --------------------------------------
// These live here (rather than `@/api/client`) so that `@/db/database` can
// import `seedRecipes` / `getPaceCalibrations` without pulling in the client
// (which would create a circular import via `enqueuePendingCookSession`).

/**
 * The backend serializes decimal columns as strings (e.g.
 * `"community_avg_minutes": "24.00"`), but the TS types declare `number | null`.
 * The SQLite cache path normalizes via REAL affinity; this normalizes the raw
 * network path so arithmetic never accidentally string-concatenates.
 */
export const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export function normalizeStep(s: any): RecipeStep {
  return {
    ...s,
    publisher_minutes: toNum(s.publisher_minutes),
    community_minutes: toNum(s.community_minutes),
  };
}

export function normalizeRecipe(r: any): Recipe {
  const factorsSrc = r?.cleanup_factors;
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
    image_url:
      r?.image_url && String(r.image_url).trim()
        ? String(r.image_url).trim()
        : null,
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
    cleanup_estimate_minutes: toNum(r.cleanup_estimate_minutes),
    ...(cleanup_factors ? { cleanup_factors } : {}),
    recipe_steps: Array.isArray(r.recipe_steps)
      ? r.recipe_steps.map(normalizeStep)
      : r.recipe_steps,
  };
}

export function normalizePaceCalibration(c: any): PaceCalibration {
  return {
    step_type: String(c.step_type),
    personal_avg_minutes: toNum(c.personal_avg_minutes),
    community_avg_minutes: toNum(c.community_avg_minutes),
    multiplier: toNum(c.multiplier) ?? 1,
    confidence: toNum(c.confidence) ?? 0,
  };
}

export async function seedRecipes(): Promise<Recipe[]> {
  const { data } = await http.get<{ data: Recipe[] }>("/api/recipes/seed");
  return data.data.map(normalizeRecipe);
}

/** One page of LIGHT recipe rows (no steps) from a paginated endpoint. */
export interface RecipePage {
  recipes: Recipe[];
  currentPage: number;
  lastPage: number;
  total: number;
}

/**
 * Laravel paginator envelope. `meta` may be missing/odd (e.g. a backend that
 * doesn't paginate yet), so every field is read defensively.
 */
interface PagedRecipesResponse {
  data?: unknown[];
  meta?: {
    current_page?: unknown;
    last_page?: unknown;
    total?: unknown;
  };
}

/** Coerce an unknown paginator field to a positive integer, else null. */
function toPositiveInt(v: unknown): number | null {
  const n = toNum(v);
  return n != null && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/**
 * Normalize a paginator payload into a RecipePage. When `meta` is missing
 * (legacy endpoints that return everything in one shot), estimate: a short
 * page means we're on the last one; a full-or-larger page estimates the page
 * count from the returned length so callers terminate on repeated full dumps.
 */
function normalizePage(
  payload: PagedRecipesResponse | undefined,
  page: number,
  perPage: number,
): RecipePage {
  const recipes = Array.isArray(payload?.data)
    ? payload.data.map((r) => normalizeRecipe(r))
    : [];
  const meta = payload?.meta;
  const metaLast = toPositiveInt(meta?.last_page);
  const metaTotal = toNum(meta?.total);

  return {
    recipes,
    currentPage: toPositiveInt(meta?.current_page) ?? page,
    lastPage:
      metaLast ??
      (recipes.length < perPage
        ? page
        : Math.ceil(recipes.length / perPage)),
    total: metaTotal != null && metaTotal >= 0 ? metaTotal : recipes.length,
  };
}

/** One page of LIGHT recipe rows (no steps) from the paginated index endpoint. */
export async function fetchRecipePage(
  page: number,
  perPage = 100,
): Promise<RecipePage> {
  const { data } = await http.get<PagedRecipesResponse>("/api/recipes", {
    params: { page, per_page: perPage },
  });
  return normalizePage(data, page, perPage);
}

/** One page of FULL recipes (with recipe_steps) from the paged seed endpoint. */
export async function fetchSeedPage(
  page: number,
  perPage = 50,
): Promise<RecipePage> {
  const { data } = await http.get<PagedRecipesResponse>("/api/recipes/seed", {
    params: { page, per_page: perPage },
  });
  return normalizePage(data, page, perPage);
}

/**
 * Fetch the authenticated user's per-step-type pace calibrations. Auth is
 * handled by the existing request interceptor. On a 401 (e.g. token cleared),
 * returns an empty array instead of throwing so callers can degrade silently.
 */
export async function getPaceCalibrations(): Promise<PaceCalibration[]> {
  try {
    const { data } = await http.get<{ data: PaceCalibration[] }>(
      "/api/pace-calibrations",
    );
    return Array.isArray(data?.data)
      ? data.data.map(normalizePaceCalibration)
      : [];
  } catch (error) {
    // A 401 (e.g. token cleared) degrades silently to an empty list; a 402
    // paywall is rethrown so callers can surface the upgrade CTA.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return [];
    }
    throw error;
  }
}
