/**
 * Google-only authentication (FOUNDATION OWNED).
 *
 * Mirrors mobile/src/api/client.ts auth flow on web storage:
 *   - loginWithGoogle posts { id_token, nonce } to /api/auth/google; the
 *     nonce is the single-use random value the client embedded in the Google
 *     sign-in attempt, and the backend rejects tokens whose nonce doesn't
 *     match (neutralizes injected/replayed tokens). The returned Sanctum
 *     token is persisted to localStorage 'rr_token' via http.ts.
 *   - logout POSTs /api/auth/logout (server-side token revocation, best
 *     effort) and always clears the local token afterwards.
 */
import { getAuthToken, post, setAuthToken } from "@/api/http";

import type { AuthResponse } from "@/api/types";

/**
 * Sign in (or register) with a Google ID token: POST /api/auth/google.
 * Google is the only auth method. On success the response token is persisted
 * and the signed-in user is returned for the AuthContext to adopt.
 */
export async function loginWithGoogle(
  idToken: string,
  nonce: string,
): Promise<AuthResponse> {
  const data = await post<AuthResponse>("/auth/google", {
    id_token: idToken,
    nonce,
  });
  if (data?.token) {
    setAuthToken(data.token);
  }
  return data;
}

/**
 * Sign out: revoke the token server-side, then drop it locally. The server
 * call is best-effort (network failure must not leave a zombie token on this
 * device), so the local clear runs even when the POST throws — callers get
 * the error only if they want to surface it, but the client is signed out
 * either way.
 */
export async function logout(): Promise<void> {
  try {
    await post<void>("/auth/logout");
  } finally {
    setAuthToken(null);
  }
}

/** The persisted bearer token, or null when signed out. */
export function getApiToken(): string | null {
  return getAuthToken();
}
