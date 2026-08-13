import axios, { type AxiosInstance } from "axios";
import * as SecureStore from "expo-secure-store";

import { API_BASE_URL, AUTH_TOKEN_KEY } from "@/config";

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
