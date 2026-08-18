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
  MyProfile,
  Paginated,
  Post,
  PostComment,
  PostCommentsPage,
  PostInput,
  PostKind,
  PostLikeResult,
  PostUser,
  PostsPage,
  PublicProfile,
  Recipe,
  RecipeNote,
  RecipeNotesPage,
  SearchParams,
  Usage,
  UserRecipeInput,
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
 * Permanently delete the signed-in account: DELETE /api/account (authed,
 * Sanctum bearer) → 204 on success, after which the local token is cleared
 * like logout(). A 401 means the token is already gone or invalid — the
 * account is unreachable either way — so it is treated as success and the
 * token is still cleared. Any other failure rethrows (token stays put).
 */
export async function deleteAccount(): Promise<void> {
  try {
    await api.delete("/api/account");
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
      return;
    }
    throw error;
  }
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
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
 * The curated Home rails (GET /api/home, 5-min server cache). Rows are
 * light and some rails may legitimately be empty until server data lands —
 * callers decide whether to fall back to their local cache rails. A network
 * failure rethrows so the caller can degrade.
 *
 * `most_underestimated` is NOT served by /api/home — it comes from
 * GET /api/reality (see fetchRealityRail) and is merged in by the caller; the
 * empty array here just satisfies the HomeRails shape.
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
    most_underestimated: [],
  };
}

/**
 * The reality rail (GET /api/reality?mode=under|over): recipes whose REAL
 * cook times diverge most from their claims, as light recipe rows including
 * the `reality` block. Defensive: any failure or non-array payload resolves
 * to an empty list so Home can hide the rail silently instead of degrading
 * the rest of the screen.
 */
export async function fetchRealityRail(
  mode: "under" | "over" = "under",
): Promise<Recipe[]> {
  try {
    const { data } = await api.get<{ data?: unknown }>("/api/reality", {
      params: { mode },
    });
    const rows = data?.data;
    return Array.isArray(rows) ? rows.map(normalizeRecipe) : [];
  } catch {
    // Offline / server error / not deployed yet: hide the rail.
    return [];
  }
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

// ---- User-submitted recipes, notes & profile ----------------------------------

/**
 * Thrown when the server REJECTS user content (recipe or note) because it
 * contains non-halal terms. The 422 body is
 * `{message, errors: {halal: ["wine", ...]}}` — the offending terms are
 * surfaced to the user so they can edit the text.
 */
export class HalalRejectionError extends Error {
  /** The offending terms reported by the server. */
  readonly terms: string[];

  constructor(terms: string[]) {
    super(`Blocked non-halal terms: ${terms.join(", ")}`);
    this.name = "HalalRejectionError";
    this.terms = terms;
  }
}

/** Thrown when posting a community note hits a 401 (no/expired token). */
export class RecipeNoteUnauthorizedError extends Error {
  constructor() {
    super("Sign in to post a note");
    this.name = "RecipeNoteUnauthorizedError";
  }
}

/** Extract the halal term list from a Laravel 422 `{errors: {halal: [...]}}`. */
function extractHalalTerms(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 422) {
    return null;
  }
  const body = error.response.data as
    | { errors?: Record<string, unknown> }
    | undefined;
  const halal = body?.errors?.halal;
  if (!Array.isArray(halal)) return null;
  const terms = halal.filter(
    (term): term is string => typeof term === "string" && term.length > 0,
  );
  return terms.length > 0 ? terms : null;
}

/** Run `fn`, converting a halal 422 into a HalalRejectionError. */
async function rethrowHalal<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/** Unwrap a RecipeResource response (`{data: {...}}`, or the raw resource). */
function unwrapRecipeResource(payload: unknown): Recipe {
  const body = payload as { data?: unknown } | undefined;
  return normalizeRecipe(body?.data ?? payload);
}

/** Create a user-submitted recipe (POST /api/recipes, authed) → the recipe. */
export async function createUserRecipe(
  input: UserRecipeInput,
): Promise<Recipe> {
  return rethrowHalal(async () => {
    const { data } = await api.post("/api/recipes", input);
    return unwrapRecipeResource(data);
  });
}

/** Update the signed-in user's recipe (PATCH /api/recipes/{id}, owner-only). */
export async function updateUserRecipe(
  id: number,
  input: UserRecipeInput,
): Promise<Recipe> {
  return rethrowHalal(async () => {
    const { data } = await api.patch(`/api/recipes/${id}`, input);
    return unwrapRecipeResource(data);
  });
}

/** Delete the signed-in user's recipe (DELETE /api/recipes/{id}) → 204. */
export async function deleteUserRecipe(id: number): Promise<void> {
  await api.delete(`/api/recipes/${id}`);
}

/** One page of the signed-in user's light recipe rows (GET /api/users/me/recipes). */
export async function fetchMyRecipes(
  page = 1,
): Promise<Paginated<Recipe>> {
  const { data } = await api.get<Paginated<Recipe>>(
    "/api/users/me/recipes",
    { params: { page } },
  );
  return {
    ...data,
    data: Array.isArray(data?.data) ? data.data.map(normalizeRecipe) : [],
  };
}

/**
 * Upload an image (POST /api/uploads, authed, multipart `image`,
 * jpg/png/webp ≤4MB) and return its public URL. React Native's FormData takes
 * a `{uri, name, type}` file blob; the type defaults to jpeg and is inferred
 * from the uri extension when possible. The Content-Type header is set per
 * request so axios lets the native layer add the multipart boundary.
 */
export async function uploadImage(uri: string): Promise<string> {
  const ext = uri.split("?")[0].split(".").pop()?.toLowerCase();
  const type =
    ext === "png"
      ? "image/png"
      : ext === "webp"
        ? "image/webp"
        : "image/jpeg";
  const name = `photo.${ext === "png" || ext === "webp" ? ext : "jpg"}`;
  const form = new FormData();
  // React Native's FormData accepts `{uri, name, type}` file parts at runtime;
  // the DOM lib types only know Blob, hence the cast.
  form.append("image", { uri, name, type } as unknown as Blob);
  const { data } = await api.post<{ url?: string }>("/api/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = data?.url;
  if (typeof url !== "string" || url.length === 0) {
    throw new Error("Upload failed: no URL returned");
  }
  return url;
}

/** Page size of the public notes endpoint (server-fixed at 20). */
const NOTES_PER_PAGE = 20;

/** Normalize one note row defensively (user block may be partial in dev). */
function normalizeNote(n: any): RecipeNote {
  return {
    id: Number(n?.id),
    body: typeof n?.body === "string" ? n.body : "",
    created_at: typeof n?.created_at === "string" ? n.created_at : "",
    user: {
      id: Number(n?.user?.id),
      display_name: n?.user?.display_name ?? null,
      name: n?.user?.name ?? null,
      avatar_url: n?.user?.avatar_url ?? null,
    },
  };
}

/**
 * One page of a recipe's PUBLIC community notes (GET /api/recipes/{id}/notes,
 * 20/page). `hasMore` prefers the paginator meta, falling back to a full page
 * heuristic when meta is missing.
 */
export async function fetchRecipeNotes(
  recipeId: number,
  page = 1,
): Promise<RecipeNotesPage> {
  const { data } = await api.get<{ data?: unknown; meta?: {
    current_page?: unknown;
    last_page?: unknown;
  } }>(`/api/recipes/${recipeId}/notes`, { params: { page } });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const notes = rows.map(normalizeNote);
  const current = Number(data?.meta?.current_page) || page;
  const last = Number(data?.meta?.last_page) || current;
  return { notes, hasMore: current < last || notes.length >= NOTES_PER_PAGE };
}

/**
 * Post a community note (POST /api/recipes/{id}/notes, authed,
 * body 1..1000) → the created note. A 401 maps to
 * RecipeNoteUnauthorizedError; a halal 422 maps to HalalRejectionError.
 */
export async function postRecipeNote(
  recipeId: number,
  body: string,
): Promise<RecipeNote> {
  try {
    const { data } = await api.post(`/api/recipes/${recipeId}/notes`, { body });
    return normalizeNote((data as { data?: unknown })?.data ?? data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new RecipeNoteUnauthorizedError();
    }
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/** The signed-in user's public profile (GET /api/users/me/profile). */
export async function fetchMyProfile(): Promise<PublicProfile> {
  const { data } = await api.get<PublicProfile>("/api/users/me/profile");
  const body = (data as { data?: PublicProfile } | undefined)?.data ?? data;
  return {
    id: Number(body?.id),
    name: body?.name ?? null,
    display_name: body?.display_name ?? null,
    avatar_url: body?.avatar_url ?? null,
  };
}

/** Update the signed-in user's display name (PATCH /api/users/me/profile). */
export async function updateDisplayName(name: string): Promise<PublicProfile> {
  const { data } = await api.patch("/api/users/me/profile", {
    display_name: name,
  });
  const body = (data as { data?: PublicProfile } | undefined)?.data ?? data;
  return {
    id: Number(body?.id),
    name: body?.name ?? null,
    display_name: body?.display_name ?? null,
    avatar_url: body?.avatar_url ?? null,
  };
}

// ---- Community posts ----------------------------------------------------------

/** Thrown when a community post/comment/like action hits a 401 (no/expired token). */
export class PostUnauthorizedError extends Error {
  constructor() {
    super("Sign in to join the community");
    this.name = "PostUnauthorizedError";
  }
}

/** Page size of the public posts + comments endpoints (server-fixed at 20). */
const POSTS_PER_PAGE = 20;

/** Normalize a post/comment author block defensively (dev payloads are partial). */
function normalizePostUser(u: any): PostUser {
  return {
    id: Number(u?.id),
    display_name: u?.display_name ?? null,
    name: u?.name ?? null,
    avatar_url: u?.avatar_url ?? null,
  };
}

/** Normalize one post row defensively (recipe block may be null/partial). */
function normalizePost(p: any): Post {
  return {
    id: Number(p?.id),
    kind: p?.kind === "fail" || p?.kind === "question" ? p.kind : "try",
    body: typeof p?.body === "string" ? p.body : "",
    image_url: p?.image_url ?? null,
    created_at: typeof p?.created_at === "string" ? p.created_at : "",
    user: normalizePostUser(p?.user),
    recipe:
      p?.recipe != null
        ? {
            id: Number(p.recipe.id),
            title: typeof p.recipe.title === "string" ? p.recipe.title : "",
            title_ar: p.recipe.title_ar ?? null,
            image_url: p.recipe.image_url ?? null,
          }
        : null,
    likes_count: toNum(p?.likes_count) ?? 0,
    comments_count: toNum(p?.comments_count) ?? 0,
    liked_by_me: Boolean(p?.liked_by_me),
  };
}

/** Normalize one comment row defensively. */
function normalizePostComment(c: any): PostComment {
  return {
    id: Number(c?.id),
    body: typeof c?.body === "string" ? c.body : "",
    created_at: typeof c?.created_at === "string" ? c.created_at : "",
    user: normalizePostUser(c?.user),
  };
}

/** Whether more pages exist: prefer paginator meta, else a full-page heuristic. */
function morePages(body: any, page: number, rows: number): boolean {
  const current = Number(body?.meta?.current_page) || page;
  const last = Number(body?.meta?.last_page) || current;
  return current < last || rows >= POSTS_PER_PAGE;
}

/**
 * One page of the public community feed (GET /api/posts, 20/page
 * newest-first). `kind` filters to try|fail|question; omit it for all posts.
 */
export async function fetchPosts(
  kind?: PostKind,
  page = 1,
): Promise<PostsPage> {
  const { data } = await api.get<{ data?: unknown }>(`/api/posts`, {
    params: { ...(kind ? { kind } : {}), page },
  });
  const rows = Array.isArray(data?.data) ? data.data.map(normalizePost) : [];
  return { posts: rows, hasMore: morePages(data, page, rows.length) };
}

/**
 * Publish a community post (POST /api/posts, authed, body 1..2000) → the
 * created post. A 401 maps to PostUnauthorizedError; a halal 422 maps to
 * HalalRejectionError.
 */
export async function createPost(input: PostInput): Promise<Post> {
  try {
    const { data } = await api.post("/api/posts", input);
    return normalizePost((data as { data?: unknown })?.data ?? data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new PostUnauthorizedError();
    }
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/**
 * Toggle the signed-in user's like on a post (POST /api/posts/{id}/like,
 * authed) → the new {liked, likes_count}. A 401 maps to
 * PostUnauthorizedError.
 */
export async function togglePostLike(
  postId: number,
): Promise<PostLikeResult> {
  try {
    const { data } = await api.post<{ liked?: unknown; likes_count?: unknown }>(
      `/api/posts/${postId}/like`,
    );
    return {
      liked: Boolean(data?.liked),
      likes_count: toNum(data?.likes_count) ?? 0,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new PostUnauthorizedError();
    }
    throw error;
  }
}

/**
 * One page of a post's comments (GET /api/posts/{id}/comments, public,
 * 20/page oldest-first).
 */
export async function fetchPostComments(
  postId: number,
  page = 1,
): Promise<PostCommentsPage> {
  const { data } = await api.get<{ data?: unknown }>(
    `/api/posts/${postId}/comments`,
    { params: { page } },
  );
  const rows = Array.isArray(data?.data)
    ? data.data.map(normalizePostComment)
    : [];
  return { comments: rows, hasMore: morePages(data, page, rows.length) };
}

/**
 * Comment on a post (POST /api/posts/{id}/comments, authed, body 1..1000) →
 * the created comment. A 401 maps to PostUnauthorizedError; a halal 422 maps
 * to HalalRejectionError.
 */
export async function createPostComment(
  postId: number,
  body: string,
): Promise<PostComment> {
  try {
    const { data } = await api.post(`/api/posts/${postId}/comments`, { body });
    return normalizePostComment((data as { data?: unknown })?.data ?? data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new PostUnauthorizedError();
    }
    const terms = extractHalalTerms(error);
    if (terms) throw new HalalRejectionError(terms);
    throw error;
  }
}

/**
 * The signed-in user's full profile incl. counters
 * (GET /api/users/me/profile → {user, counts}). Numeric counters are
 * normalized defensively; an envelope `data` wrapper is tolerated.
 */
export async function fetchMyProfileFull(): Promise<MyProfile> {
  const { data } = await api.get("/api/users/me/profile");
  const body = (data as { data?: any } | undefined)?.data ?? data;
  return {
    user: {
      id: Number(body?.user?.id),
      display_name: body?.user?.display_name ?? null,
      name: body?.user?.name ?? null,
      avatar_url: body?.user?.avatar_url ?? null,
      created_at:
        typeof body?.user?.created_at === "string" ? body.user.created_at : "",
    },
    counts: {
      recipes: toNum(body?.counts?.recipes) ?? 0,
      public_notes: toNum(body?.counts?.public_notes) ?? 0,
      posts: toNum(body?.counts?.posts) ?? 0,
      likes_received: toNum(body?.counts?.likes_received) ?? 0,
    },
  };
}
