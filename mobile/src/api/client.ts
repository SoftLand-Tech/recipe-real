import axios from "axios";
import * as SecureStore from "expo-secure-store";

import { AUTH_TOKEN_KEY } from "@/config";
import { enqueuePendingCookSession } from "@/db/database";
import {
  http,
  isOfflineError,
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

/**
 * Sign in (or register) with a Google ID token: POST /api/auth/google with
 * `{ id_token }`. Google is the only auth method; the response token is
 * persisted to SecureStore for subsequent authenticated calls.
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
 * Submit a completed cook session. Only a GENUINE network failure (axios
 * error with no response — the server never replied) falls back to the local
 * pending queue and resolves successfully so the user is never blocked while
 * offline. A server 4xx/5xx answer (has `.response`) or a non-axios throw
 * (e.g. a SecureStore failure in the request interceptor) can never succeed
 * on retry, so it is rethrown for the caller to surface.
 */
export async function submitCookSession(
  payload: CookSessionPayload,
): Promise<void> {
  try {
    await postCookSessionRaw(payload);
  } catch (error) {
    // Offline = axios error with no response (e.g. timeout, no network).
    if (isOfflineError(error)) {
      await enqueuePendingCookSession(payload);
      return;
    }
    throw error;
  }
}

/** Page size when fetching the cook-session history. */
const COOK_SESSIONS_PER_PAGE = 100;
/** Safety cap for the history loop: 5 pages x 100 = 500 sessions max. */
const COOK_SESSIONS_MAX_PAGES = 5;

/** One page of the cook-session history. */
async function fetchCookSessionsPage(
  page: number,
): Promise<Paginated<CookSessionSummary>> {
  const { data } = await api.get<Paginated<CookSessionSummary>>(
    "/api/cook-sessions",
    { params: { page, per_page: COOK_SESSIONS_PER_PAGE } },
  );
  return data;
}

/**
 * Fetch the user's FULL cook-session history for Pace stats.
 *
 * The endpoint paginates (Laravel default 15/page), so a single request
 * silently truncated history — undercounting Pace streaks for active users.
 * Walk every page (`per_page=100`, capped at COOK_SESSIONS_MAX_PAGES pages)
 * and merge the `data` arrays; `meta` (including `total`) is kept from the
 * FIRST response so the returned shape stays exactly
 * `Paginated<CookSessionSummary>`.
 *
 * A failure on a LATER page returns what was fetched so far rather than
 * throwing; a failure on page 1 still throws (matching the old behavior —
 * callers already handle a total failure). A missing `meta` (unpaginated
 * legacy response) is treated as a single page, mirroring the defensive
 * handling in `@/api/http`.
 */
export async function getCookSessions(): Promise<Paginated<CookSessionSummary>> {
  const merged: CookSessionSummary[] = [];
  let meta: Paginated<CookSessionSummary>["meta"] | undefined;

  for (let page = 1; page <= COOK_SESSIONS_MAX_PAGES; page++) {
    let body: Paginated<CookSessionSummary>;
    try {
      body = await fetchCookSessionsPage(page);
    } catch (error) {
      if (page === 1) throw error; // Nothing fetched yet: surface it.
      break; // Partial fetch: return what we already have.
    }

    const rows = Array.isArray(body?.data) ? body.data : [];
    merged.push(...rows.map(normalizeCookSession));

    if (meta == null) {
      // Keep the first response's meta (incl. total) for the merged result.
      meta = body?.meta ?? {
        current_page: 1,
        last_page: 1,
        per_page: COOK_SESSIONS_PER_PAGE,
        total: merged.length,
      };
    }

    const currentPage = Number(body?.meta?.current_page) || page;
    const lastPage = Number(body?.meta?.last_page) || currentPage;
    // Done when the paginator says we're on the last page, or when a short
    // page comes back (covers empty pages and backends with a missing/odd
    // meta, mirroring the heuristic in `@/api/http`).
    if (currentPage >= lastPage || rows.length < COOK_SESSIONS_PER_PAGE) {
      break;
    }
  }

  return {
    data: merged,
    meta:
      meta ?? {
        current_page: 1,
        last_page: 1,
        per_page: COOK_SESSIONS_PER_PAGE,
        total: merged.length,
      },
  };
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
