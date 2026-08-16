import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  fetchSearchPage,
  type RecipePage,
} from "@/api/http";

// Re-export the shared axios instance + raw POST + the seed/pace fetchers so
// existing `import { ... } from "@/api/client"` calls keep working. The
// implementations live in `@/api/http` to avoid a circular import between the
// client and `@/db/database`.
export { http, postCookSessionRaw, seedRecipes, getPaceCalibrations };
export type { RecipePage } from "@/api/http";

// Use the shared instance for all calls below.
const api = http;

import type {
  AuthResponse,
  BillingPlan,
  CategoryCount,
  CookSessionPayload,
  CookSessionSummary,
  GetRecipesParams,
  HomeRails,
  Paginated,
  Recipe,
  SearchParams,
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

// ---- Server-driven browse & home --------------------------------------------

/** Page size for the server-driven Browse list (server clamps to 1..50). */
const SEARCH_PER_PAGE = 20;

/**
 * One page of the public search endpoint (GET /api/recipes/search). Empty `q`
 * is a filtered browse; the response rows are LIGHT (no recipe_steps) and
 * defensively normalized (the local dev DB has metadata only partially).
 */
export async function searchRecipes(
  params: SearchParams = {},
): Promise<RecipePage> {
  return fetchSearchPage({
    q: params.q,
    category: params.category,
    max_time: params.maxTime,
    sort: params.sort,
    page: params.page,
    per_page: params.perPage ?? SEARCH_PER_PAGE,
  });
}

/** AsyncStorage cache key for the category chips (server data, 1h-cached server-side). */
const CATEGORIES_CACHE_KEY = "recipereal.categories";
/** Local staleness window for the cached category chips. */
const CATEGORIES_TTL_MS = 60 * 60 * 1000;

interface CachedCategories {
  savedAt: number;
  data: CategoryCount[];
}

/** Defensive CategoryCount row filter (never trust a partial dev payload). */
function validCategoryRows(rows: unknown): CategoryCount[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const c = row as { category?: unknown; count?: unknown };
      return {
        category:
          typeof c?.category === "string" ? c.category.trim() : "",
        count: toNum(c?.count) ?? 0,
      };
    })
    .filter((c) => c.category.length > 0);
}

/**
 * Top real recipe categories (GET /api/recipes/categories). Served from a
 * 1-hour server cache; the fresh payload is mirrored into AsyncStorage so an
 * offline launch can reuse the last known chips. Any failure (or an empty
 * response — the local dev DB may have none) falls back to the stale cache,
 * then to an empty array so callers can use their local keyword categories.
 */
export async function fetchCategories(): Promise<CategoryCount[]> {
  try {
    const { data } = await api.get<{ data: unknown }>(
      "/api/recipes/categories",
    );
    const rows = validCategoryRows(data?.data);
    if (rows.length > 0) {
      AsyncStorage.setItem(
        CATEGORIES_CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), data: rows } satisfies CachedCategories),
      ).catch(() => {
        // Non-fatal: caching is best-effort.
      });
      return rows;
    }
  } catch {
    // Offline / server error: the stale cache below is the fallback.
  }
  try {
    const raw = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CachedCategories) : null;
    if (
      parsed &&
      Date.now() - (parsed.savedAt ?? 0) < CATEGORIES_TTL_MS &&
      Array.isArray(parsed.data)
    ) {
      return validCategoryRows(parsed.data);
    }
  } catch {
    // Non-fatal: fall through to an empty list (caller uses local chips).
  }
  return [];
}

/**
 * The four curated Home rails (GET /api/home, 5-min server cache). Rows are
 * light and some rails may legitimately be empty until server data lands —
 * callers decide whether to fall back to their local cache rails. A network
 * failure rethrows so the caller can degrade.
 */
export async function fetchHomeRails(): Promise<HomeRails> {
  const { data } = await api.get<{ data?: Partial<HomeRails> }>("/api/home");
  const rails = (value: unknown): Recipe[] =>
    Array.isArray(value) ? value.map(normalizeRecipe) : [];
  const src = data?.data ?? {};
  return {
    top_rated: rails(src.top_rated),
    easy_wins: rails(src.easy_wins),
    most_loved: rails(src.most_loved),
    hands_off: rails(src.hands_off),
  };
}

/**
 * Thrown by submitQuickTime when the server answers 401 (no/expired token).
 * Screens catch this instance to show a "Sign in to contribute" CTA instead
 * of a generic error.
 */
export class QuickTimeUnauthorizedError extends Error {
  constructor() {
    super("Sign in to contribute");
    this.name = "QuickTimeUnauthorizedError";
  }
}

/** Honest-breakdown contribution payload for POST /api/recipes/{id}/quick-time. */
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

/** Server response of the quick-time endpoint; averages may serialize as strings. */
export interface QuickTimeBreakdownResult {
  ok: boolean;
  community_avg_minutes: number | null;
  cleanup_avg_minutes: number | null;
}

/**
 * Honest-time contribution (POST /api/recipes/{id}/quick-time, auth:sanctum):
 * the required total minutes plus optional cleanup / hands-on / servings
 * fields. `community_avg_minutes` and `cleanup_avg_minutes` may serialize as
 * strings ("24.00") — they are normalized to numbers here. Any failure
 * rethrows; a 401 becomes a QuickTimeUnauthorizedError so the caller can
 * prompt sign-in.
 */
export async function submitQuickTime(
  recipeId: number,
  breakdown: QuickTimeBreakdown,
): Promise<QuickTimeBreakdownResult> {
  try {
    const { data } = await api.post<Record<string, unknown>>(
      `/api/recipes/${recipeId}/quick-time`,
      breakdown,
    );
    return {
      ok: Boolean(data?.ok),
      community_avg_minutes: toNum(data?.community_avg_minutes),
      cleanup_avg_minutes: toNum(data?.cleanup_avg_minutes),
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new QuickTimeUnauthorizedError();
    }
    throw error;
  }
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
