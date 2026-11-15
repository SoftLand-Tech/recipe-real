/**
 * Foundation dictionary: Google sign-in screen (namespace `auth.*`).
 * OWNED BY FOUNDATION. Strings mirror mobile's login.* terminology.
 */
export const en: Record<string, string> = {
  "auth.pageTitle": "Sign in",
  "auth.title": "Welcome back",
  "auth.subtitle":
    "Sign in to track your pace, post your cooks, and keep your recipes in sync.",
  // Accessible label for the GIS button container + fallback link text.
  "auth.googleButton": "Continue with Google",
  "auth.googleCaption": "Sign in with Google — no password needed.",
  "auth.signingIn": "Signing in…",

  // ---- Errors ---------------------------------------------------------------
  "auth.errNotConfigured":
    "Google sign-in isn't configured for this deployment yet.",
  "auth.errNotReady": "Google sign-in isn't ready yet. Try again in a moment.",
  "auth.errNotComplete": "Google sign-in didn't complete. Please try again.",
  "auth.errOffline":
    "Couldn't reach the server. Check your connection and try again.",

  // ---- Signed-out states ----------------------------------------------------
  "auth.signedOutTitle": "You're signed out",
  "auth.signedOutBody": "Your session ended. Sign in again to continue.",
  // Shown on /login when redirected from a gated route.
  "auth.returnPrompt": "Sign in to continue to that page.",
};
