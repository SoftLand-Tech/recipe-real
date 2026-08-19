import Constants from "expo-constants";

/**
 * Base URL of the RecipeReal backend (Laravel API).
 *
 * Priority:
 *   1. Expo extra `recipereal.apiBaseUrl` (app.json `expo.extra`)
 *   2. Expo release-channel / manifest extra fallback
 *   3. `http://localhost:8000`
 */
function resolveBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as
    | { reciperealApiBaseUrl?: string }
    | undefined;

  const fromExtra = extra?.reciperealApiBaseUrl;
  if (fromExtra && typeof fromExtra === "string" && fromExtra.length > 0) {
    return fromExtra.replace(/\/+$/, "");
  }

  return "http://localhost:8000";
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Public web app origin (APP_URL of the Laravel backend). The mobile Share
 * buttons point at its public recipe pages (/r/{id}) so WhatsApp and other
 * targets render a real https link with an OpenGraph preview.
 */
export const WEB_BASE_URL = "https://recipe-real.softland.tech";

/** AsyncStorage key for the persisted auth token. */
export const AUTH_TOKEN_KEY = "recipereal.token";
