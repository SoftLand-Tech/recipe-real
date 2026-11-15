/**
 * Auth state provider (FOUNDATION OWNED — every other slice consumes
 * useAuth() and never touches tokens directly).
 *
 * Status machine: 'loading' (a token exists and /api/user is being checked,
 * or first paint) → 'authed' | 'anon'. The user row comes from
 * GET /api/user, mirroring the backend's Sanctum session semantics.
 *
 * The provider also listens for http.ts's 'rr:auth-expired' event (fired on
 * any 401) and flips to 'anon' immediately, so a token revoked server-side
 * signs the user out on their next request rather than lingering.
 *
 * <RequireAuth> gates routes that need an account: anon visitors are
 * redirected to /login with a `returnTo` search param the LoginPage honors
 * after sign-in.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router";

import { AUTH_EXPIRED_EVENT, getAuthToken } from "@/api/http";
import { get as apiGet } from "@/api/http";
import { loginWithGoogle, logout as apiLogout } from "@/api/auth";

import { Spinner } from "@/components/Spinner";

import type { User } from "@/api/types";

export type AuthStatus = "loading" | "anon" | "authed";

interface AuthContextValue {
  status: AuthStatus;
  /** The signed-in user (null while loading or signed out). */
  user: User | null;
  /** Exchange a Google id_token (+ its nonce) for a session. */
  login: (idToken: string, nonce: string) => Promise<User>;
  /** Revoke + clear the session. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    // No token ⇒ immediately anon; with one, verify it against /api/user
    // before trusting the signed-in UI.
    () => (getAuthToken() ? "loading" : "anon"),
  );
  const [user, setUser] = useState<User | null>(null);

  // Boot: if a token exists, adopt the user it names. A 401 here has already
  // cleared the token + fired the event (handled below); any other failure
  // also degrades to anon — a stale session must never block the app.
  useEffect(() => {
    if (!getAuthToken()) return;
    let cancelled = false;
    apiGet<User>("/user")
      .then((row) => {
        if (cancelled) return;
        setUser(row);
        setStatus("authed");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("anon");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // http.ts fires this on any 401 (dead/revoked token): drop to signed-out
  // in place. Routes wrapped in <RequireAuth> then redirect to /login.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus("anon");
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (idToken: string, nonce: string) => {
    const res = await loginWithGoogle(idToken, nonce);
    setUser(res.user);
    setStatus("authed");
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Even if the server call failed, this device is signed out.
      setUser(null);
      setStatus("anon");
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, logout }),
    [status, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

/**
 * Route gate for pages that need an account: while the boot check runs it
 * shows a centered spinner; an anon visitor is redirected to /login carrying
 * the current location as `returnTo`, which the LoginPage navigates back to
 * after a successful sign-in.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (status === "anon") {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <>{children}</>;
}
