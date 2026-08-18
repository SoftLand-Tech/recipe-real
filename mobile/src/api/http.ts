import axios, { type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";
import type {
  CleanupFactors,
  PaceCalibration,
  RealityCheck,
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

/**
 * Client-side 429 cooldown: when the server rate-limits us, hold ALL
 * requests for a short window instead of hammering it with retries (which
 * only extend the throttle). Cleared after the window passes; requests
 * during the window fail fast with the original-style network error so
 * callers fall back to the offline cache path.
 */
let cooldownUntil = 0;

/** Attach the bearer token from SecureStore to every request, if present. */
http.interceptors.request.use(async (config) => {
  const now = Date.now();
  if (now < cooldownUntil) {
    await new Promise((resolve) => setTimeout(resolve, cooldownUntil - now));
  }
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
    if (error?.response?.status === 429) {
      // Honor the server's Retry-After when present (Laravel sends seconds),
      // else cool down for 20s so queued retries stop feeding the limiter.
      const retryAfter = Number(error.response.headers?.["retry-after"]);
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter, 60) * 1000
        : 20_000;
      cooldownUntil = Math.max(cooldownUntil, Date.now() + waitMs);
    }
    return Promise.reject(error);
  },
);

/**
 * Whether an error is a GENUINE network-level failure (offline, timeout,
 * DNS): an axios error with NO response attached, meaning the server never
 * replied. Anything else — a server 4xx/5xx answer (has `.response`) or a
 * non-axios throw (e.g. a SecureStore failure inside the request
 * interceptor) — cannot succeed by retrying later, so callers use this to
 * decide between queueing for a retry (offline) and surfacing / dropping the
 * submission. Lives here (not `@/api/client`) so the db layer can share it
 * without a circular import.
 */
export function isOfflineError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

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
    description_ar: s?.description_ar ?? null,
    publisher_minutes: toNum(s.publisher_minutes),
    community_minutes: toNum(s.community_minutes),
  };
}

/**
 * Parse an Arabic-content array field that may arrive as a raw JSON string
 * (how the API passes the DB json columns through) or an already-decoded
 * array. Anything else → null (English fallback). Local copy of the db
 * layer's parseJsonStringArray — that one is module-private and importing
 * it here would create the http↔db circular import this split exists to
 * avoid.
 */
function parseArArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    return raw.every((x) => typeof x === "string") ? raw : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.every((x) => typeof x === "string")
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normalize the reality-check block defensively: decimals may serialize as
 * strings, and a malformed/absent object must read as "unknown" (null) so the
 * badge simply stays hidden. Numeric holes collapse to 0 except gap_pct, which
 * keeps its null meaning ("no claim to compare against").
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
    // User-submitted recipes may be Arabic-only (title null): keep the type
    // non-optional by defaulting to "" — the localized getter falls back to
    // title_ar for display.
    title: r?.title ?? "",
    image_url:
      r?.image_url && String(r.image_url).trim()
        ? String(r.image_url).trim()
        : null,
    // Ownership metadata (user-submitted vs. imported foodcom rows): the id
    // may serialize as a string; source_type passes through defensively.
    owner_id: r?.owner_id == null ? null : Number(r.owner_id),
    source_type: r?.source_type != null ? String(r.source_type) : null,
    // Arabic content columns: always present, null when untranslated. The
    // API passes ingredients_ar/steps_ar through as RAW JSON STRINGS (the
    // DB columns are json text), so parse them HERE — accepting either a
    // JSON string or an already-decoded array. (The old Array.isArray-only
    // check nulled every network recipe's Arabic arrays → English shown.)
    title_ar: r?.title_ar ?? null,
    ingredients_ar: parseArArray(r?.ingredients_ar),
    steps_ar: parseArArray(r?.steps_ar),
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
    cleanup_estimate_minutes: toNum(r.cleanup_estimate_minutes),
    // Food.com metadata (server-driven rows): numbers coerced, strings and
    // the keywords array passed through defensively. Missing on SQLite rows.
    aggregated_rating: toNum(r?.aggregated_rating),
    review_count: toNum(r?.review_count),
    category: r?.category != null ? String(r.category) : null,
    keywords: Array.isArray(r?.keywords) ? r.keywords : null,
    description: r?.description ?? null,
    calories: toNum(r?.calories),
    protein_g: toNum(r?.protein_g),
    fat_g: toNum(r?.fat_g),
    ...(cleanup_factors ? { cleanup_factors } : {}),
    reality: normalizeReality(r?.reality),
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

/** Query params accepted by the public search endpoint. */
export interface SearchQuery {
  q?: string;
  category?: string;
  max_time?: number;
  sort?: string;
  page?: number;
  per_page?: number;
}

/**
 * One page of LIGHT recipe rows from the public search endpoint
 * (GET /api/recipes/search). `per_page` is clamped server-side to 1..50
 * (default 20); `sort` must be one of relevance|top_rated|fastest|most_loved
 * (the server defaults to relevance when `q` is present, else top_rated).
 */
export async function fetchSearchPage(
  query: SearchQuery = {},
): Promise<RecipePage> {
  const page = query.page ?? 1;
  const perPage = query.per_page ?? 20;
  const { data } = await http.get<PagedRecipesResponse>(
    "/api/recipes/search",
    {
      params: {
        ...(query.q ? { q: query.q } : {}),
        ...(query.category ? { category: query.category } : {}),
        ...(query.max_time != null ? { max_time: query.max_time } : {}),
        ...(query.sort ? { sort: query.sort } : {}),
        page,
        per_page: perPage,
      },
    },
  );
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
