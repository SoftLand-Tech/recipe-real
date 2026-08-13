import axios, { type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";
import { enqueuePendingCookSession } from "@/db/database";
import type {
  AuthResponse,
  CleanupFactors,
  CookSessionPayload,
  CookSessionSummary,
  GetRecipesParams,
  PaceCalibration,
  Paginated,
  Recipe,
  RecipeStep,
} from "@/types";

/** A configured axios instance for the RecipeReal backend. */
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** Attach the bearer token from SecureStore to every request, if present. */
api.interceptors.request.use(async (config) => {
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
api.interceptors.response.use(
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

export const http = api;

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
 * Raw POST to `/api/cook-sessions`. Throws on ANY failure (network or server).
 * Used directly by `flushPendingCookSessions` in db.ts to avoid re-triggering
 * the offline fallback (which would re-enqueue and loop).
 */
export async function postCookSessionRaw(
  payload: CookSessionPayload,
): Promise<void> {
  await api.post("/api/cook-sessions", payload);
}

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
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return [];
    }
    throw error;
  }
}
