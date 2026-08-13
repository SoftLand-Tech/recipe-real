import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { AUTH_TOKEN_KEY } from "@/config";
import { enqueuePendingCookSession } from "@/db/database";
import { http, postCookSessionRaw } from "@/api/http";

// Re-export the shared axios instance + raw POST so existing
// `import { http } from "@/api/client"` and
// `import { postCookSessionRaw } from "@/api/client"` continue to work.
export { http, postCookSessionRaw };

// Use the shared instance for all calls below.
const api = http;

import type {
  AuthResponse,
  BillingPlan,
  CleanupFactors,
  CookSessionPayload,
  CookSessionSummary,
  GetRecipesParams,
  PaceCalibration,
  Paginated,
  Recipe,
  RecipeStep,
  Usage,
} from "@/types";

// ---- Normalizers -----------------------------------------------------------

/**
 * The backend serializes decimal columns as strings (e.g.
 * `"community_avg_minutes": "24.00"`), but the TS types declare `number | null`.
 * The SQLite cache path normalizes via REAL affinity; this normalizes the raw
 * network path so arithmetic never accidentally string-concatenates.
 */
const toNum = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

function normalizeStep(s: any): RecipeStep {
  return {
    ...s,
    publisher_minutes: toNum(s.publisher_minutes),
    community_minutes: toNum(s.community_minutes),
  };
}

function normalizeRecipe(r: any): Recipe {
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

// ---- Auth ------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", {
    email,
    password,
  });
  if (data?.token) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
  }
  return data;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/register", {
    name,
    email,
    password,
  });
  if (data?.token) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, data.token);
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/auth/logout");
  } finally {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  }
}

/**
 * Whether a bearer token is currently stored in SecureStore. Used by screens
 * to decide whether to attempt authenticated-only calls (e.g. pace data).
 * Best-effort: any SecureStore failure resolves to false.
 */
export async function hasToken(): Promise<boolean> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
    return Boolean(token);
  } catch {
    return false;
  }
}

// ---- Recipes ---------------------------------------------------------------

export async function getRecipes(
  params: GetRecipesParams = {},
): Promise<Paginated<Recipe>> {
  const { data } = await api.get<Paginated<Recipe>>("/api/recipes", {
    params: {
      page: params.page ?? 1,
      ...(params.search ? { search: params.search } : {}),
      ...(params.maxTime != null ? { max_time: params.maxTime } : {}),
    },
  });
  // Keep the Paginated<Recipe> shape; only normalize the inner data array.
  return { ...data, data: data.data.map(normalizeRecipe) };
}

export async function getRecipe(id: number | string): Promise<Recipe> {
  const { data } = await api.get<{ data: Recipe }>(`/api/recipes/${id}`);
  return normalizeRecipe(data.data);
}

export async function seedRecipes(): Promise<Recipe[]> {
  const { data } = await api.get<{ data: Recipe[] }>("/api/recipes/seed");
  return data.data.map(normalizeRecipe);
}

// ---- Cook sessions ---------------------------------------------------------

/**
 * Normalize a cook-session summary from the backend. Numeric columns can come
 * back as strings (Laravel decimal serialization); coerce them to numbers.
 */
function normalizeCookSession(s: any): CookSessionSummary {
  return {
    ...s,
    total_actual_minutes: toNum(s.total_actual_minutes),
    cleanup_minutes: toNum(s.cleanup_minutes),
    recipe: {
      ...s.recipe,
      community_avg_minutes: toNum(s.recipe?.community_avg_minutes),
    },
  };
}

/**
 * Raw POST to `/api/cook-sessions` is now provided by `@/api/http` (re-exported
 * above) so it can be shared with `flushPendingCookSessions` without creating a
 * circular import with the db layer.
 */

/**
 * Submit a completed cook session. On a network error (offline — no response
 * from the server), fall back to the local pending queue and resolve
 * successfully so the user is never blocked. On a real server error
 * (has `.response`), rethrow.
 */
export async function submitCookSession(
  payload: CookSessionPayload,
): Promise<void> {
  try {
    await postCookSessionRaw(payload);
  } catch (error) {
    // Offline = axios error with no response (e.g. timeout, no network).
    const isOffline =
      !axios.isAxiosError(error) || typeof error.response === "undefined";
    if (isOffline) {
      await enqueuePendingCookSession(payload);
      return;
    }
    throw error;
  }
}

/** Fetch the user's cook-session history. */
export async function getCookSessions(): Promise<Paginated<CookSessionSummary>> {
  const { data } = await api.get<Paginated<CookSessionSummary>>(
    "/api/cook-sessions",
  );
  return { ...data, data: data.data.map(normalizeCookSession) };
}

// ---- Pace calibration ------------------------------------------------------

/**
 * Coerce a raw pace-calibration row from the backend. Numeric columns can
 * arrive as strings (Laravel decimal serialization); normalize them so later
 * arithmetic never string-concatenates.
 */
function normalizePaceCalibration(c: any): PaceCalibration {
  return {
    step_type: String(c.step_type),
    personal_avg_minutes: toNum(c.personal_avg_minutes),
    community_avg_minutes: toNum(c.community_avg_minutes),
    multiplier: toNum(c.multiplier) ?? 1,
    confidence: toNum(c.confidence) ?? 0,
  };
}

/**
 * Fetch the authenticated user's per-step-type pace calibrations. Auth is
 * handled by the existing request interceptor. On a 401 (e.g. token cleared),
 * returns an empty array instead of throwing so callers can degrade silently.
 */
export async function getPaceCalibrations(): Promise<PaceCalibration[]> {
  try {
    const { data } = await api.get<{ data: PaceCalibration[] }>(
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

// ---- Billing & Usage (Week 5) ----------------------------------------------

/**
 * Whether an error is an HTTP 402 (Payment Required) paywall response from the
 * backend. Used by screens to decide between rendering a paywall CTA vs. a
 * generic error state.
 */
export function isPaywallError(e: unknown): boolean {
  return axios.isAxiosError(e) && e.response?.status === 402;
}

/**
 * Start a Stripe Checkout session for the given plan. Returns the hosted
 * Checkout URL to open in an in-app browser. Throws on any failure (including
 * 503 when billing is not yet configured on the backend).
 */
export async function createCheckout(plan: BillingPlan): Promise<string> {
  const { data } = await api.post<{ url: string }>("/api/billing/checkout", {
    plan,
  });
  return data.url;
}

/**
 * Open the Stripe customer portal to manage an existing subscription. Returns
 * the portal URL; callers open it best-effort. Throws on failure.
 */
export async function openBillingPortal(): Promise<string> {
  const { data } = await api.post<{ url: string }>("/api/billing/portal");
  return data.url;
}

/**
 * Fetch the authenticated user's usage / premium status. Numeric fields are
 * normalized defensively (the backend may serialize them as strings).
 */
export async function getUsage(): Promise<Usage> {
  const { data } = await api.get<Usage>("/api/usage");
  return {
    premium: Boolean(data?.premium),
    views_this_month: Number(data?.views_this_month) || 0,
    limit: Number(data?.limit) || 0,
  };
}
