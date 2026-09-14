import Constants from "expo-constants";

/**
 * Base URL of the RecipeReal backend (Laravel API).
 *
 * Priority:
 *   1. Expo extra `recipereal.apiBaseUrl` (app.json `expo.extra`)
 *
 * FAILS CLOSED: with no configured base URL there is no safe default —
 * falling back to cleartext http://localhost:8000 would silently send
 * bearer tokens over plaintext whenever the extra key is dropped or
 * renamed. Dev setups must configure the extra explicitly.
 */
function resolveBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { reciperealApiBaseUrl?: string }
    | undefined;

  const fromExtra = extra?.reciperealApiBaseUrl;
  if (fromExtra && typeof fromExtra === "string" && fromExtra.length > 0) {
    return fromExtra.replace(/\/+$/, "");
  }

  throw new Error(
    "reciperealApiBaseUrl is not configured in app.json expo.extra",
  );
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Public web app origin (APP_URL of the Laravel backend). The mobile Share
 * buttons point at its public recipe pages (/r/{id}) so WhatsApp and other
 * targets render a real https link with an OpenGraph preview.
 */
export const WEB_BASE_URL = "https://recipe-real.softland.tech";

/** SecureStore key for the persisted auth token. */
export const AUTH_TOKEN_KEY = "recipereal.token";

/**
 * Kill-switch for the AI recipe-import flow (upload a video → AI extract).
 * OFF while the first self-updating production APK ships: every entry
 * point (settings row, profile buttons, AI-imports track, route screen)
 * stays hidden. Flip back ON later via an EAS Update — pure JS, no new
 * binary needed.
 */
export const AI_IMPORT_ENABLED = false;
/**
 * SecureStore key for the single-use OAuth anti-injection material
 * ({ nonce, state }) generated per sign-in attempt. Persisted so a
 * cold-start deep-link completion (the OS killed the app behind Google's
 * consent screen) still finds matching material to verify against;
 * consumed on read so a captured callback can never replay.
 */
export const OAUTH_FLOW_KEY = "recipereal.oauth.flow";
