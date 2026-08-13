import axios, { type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";
import type {
  AuthResponse,
  GetRecipesParams,
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
  return {
    ...r,
    publisher_time_minutes: toNum(r.publisher_time_minutes),
    community_avg_minutes: toNum(r.community_avg_minutes),
    cleanup_avg_minutes: toNum(r.cleanup_avg_minutes),
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
