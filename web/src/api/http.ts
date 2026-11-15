/**
 * The single axios instance every web API call goes through (FOUNDATION
 * OWNED — slices import from here, never call axios/fetch directly).
 *
 * Mirrors mobile/src/api/http.ts with web-appropriate storage:
 *   - baseURL '/api' — same origin in production (Laravel serves the SPA at
 *     /app); in dev, Vite proxies /api to a local `php artisan serve`.
 *   - Bearer token from localStorage 'rr_token', attached by the request
 *     interceptor so call sites never handle auth headers.
 *   - 401 handling: the token is dead, so this layer clears it, fires the
 *     'rr:auth-expired' window event (AuthContext listens and flips to the
 *     signed-out state / redirects), and still rejects with the original
 *     error for the caller. Slice code NEVER handles 401 itself.
 */
import axios, { type AxiosRequestConfig } from "axios";

/** localStorage key for the persisted Sanctum token (contract: 'rr_token'). */
export const TOKEN_KEY = "rr_token";

/**
 * Event fired on window when a 401 invalidates the stored token. The name is
 * namespaced ('rr:') so hosting pages or future embeds can't collide with it.
 */
export const AUTH_EXPIRED_EVENT = "rr:auth-expired";

export const http = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

/** The bearer token, if one is persisted. */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private mode / storage disabled: behave as signed-out.
    return null;
  }
}

/** Persist (or clear) the bearer token. */
export function setAuthToken(token: string | null): void {
  try {
    if (token === null) {
      localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    // Storage unavailable: this session just won't persist auth.
  }
}

// Attach the bearer token to every request, if present.
http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On a 401 the token is no longer valid: drop it and broadcast the expiry so
// AuthContext can react (signed-out state + redirect to /login). The caller
// still receives the original error — slices decide how to surface failures,
// but never re-handle the auth angle.
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      setAuthToken(null);
      try {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      } catch {
        // Dispatch is best-effort; the token clear above already happened.
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Whether an error is a server rate-limit (HTTP 429): the user is searching
 * or submitting too fast. Callers show a friendly "wait a minute" toast
 * instead of a generic failure (contract: 429 must not crash).
 */
export function isRateLimitedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 429;
}

/**
 * Whether an error is a genuine network-level failure (offline, timeout,
 * DNS): an axios error with NO response attached, meaning the server never
 * replied. The web app is online-first — callers surface a retry affordance
 * rather than queueing (unlike mobile, there is no offline SQLite).
 */
export function isOfflineError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

/**
 * Whether an error is an HTTP 402 (Payment Required) paywall response.
 * Screens use it to decide between rendering a paywall CTA vs. a generic
 * error state (mirrors mobile's isPaywallError).
 */
export function isPaywallError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 402;
}

// ---- Typed request helpers ----------------------------------------------------
// Thin wrappers that unwrap the axios response so slice modules write
// `const recipe = await get<Recipe>(...)` instead of `.then(r => r.data)`.

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<T>(url, config);
  return data;
}

export async function post<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await http.post<T>(url, body, config);
  return data;
}

export async function patch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await http.patch<T>(url, body, config);
  return data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.delete<T>(url, config);
  return data;
}
