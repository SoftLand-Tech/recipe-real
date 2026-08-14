import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { AUTH_TOKEN_KEY } from "@/config";
import { enqueuePendingCookSession } from "@/db/database";
import {
  http,
  postCookSessionRaw,
  seedRecipes,
  getPaceCalibrations,
  normalizeRecipe,
  toNum,
} from "@/api/http";

// Re-export the shared axios instance + raw POST + the seed/pace fetchers so
// existing `import { ... } from "@/api/client"` calls keep working. The
// implementations live in `@/api/http` to avoid a circular import between the
// client and `@/db/database`.
export { http, postCookSessionRaw, seedRecipes, getPaceCalibrations };

// Use the shared instance for all calls below.
const api = http;

import type {
  AuthResponse,
  BillingPlan,
  CookSessionPayload,
  CookSessionSummary,
  GetRecipesParams,
  Paginated,
  Recipe,
  Usage,
} from "@/types";

// `toNum` and `normalizeRecipe` are imported from `@/api/http` (see above).

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

/**
 * Sign in (or register) with a Google ID token: POST /api/auth/google with
 * `{ id_token }`. Mirrors `login` — same response shape, same SecureStore
 * persistence — so callers can treat it exactly like an email/password sign-in.
 */
export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/google", {
    id_token: idToken,
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

// `seedRecipes` now lives in `@/api/http` and is re-exported from this module.

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

// `normalizePaceCalibration` and `getPaceCalibrations` now live in
// `@/api/http` and are re-exported from this module.

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
