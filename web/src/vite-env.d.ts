/// <reference types="vite/client" />

/**
 * Vite env vars actually read by this app. Only the Google client ID dev
 * fallback exists today; production config arrives via window.__RECIPEREAL__
 * (see index.html + the Laravel /app serving route).
 */
interface ImportMetaEnv {
  /** Dev-only Google Sign-In client ID (production injects __RECIPEREAL__). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
