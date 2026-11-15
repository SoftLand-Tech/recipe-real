/**
 * Foundation dictionary: shared actions + phrases (namespace `common.*`).
 * OWNED BY FOUNDATION — slices add keys only in their own dict files.
 * Arabic mirrors mobile/src/i18n/ar.ts terminology.
 */
export const en: Record<string, string> = {
  // ---- Actions --------------------------------------------------------------
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.retry": "Retry",
  "common.search": "Search",
  "common.seeAll": "See all",
  "common.back": "Back",
  "common.ok": "OK",

  // ---- States ---------------------------------------------------------------
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.offline":
    "You're offline. Check your connection and try again.",
  "common.rateLimited":
    "You're going too fast — wait a moment and try again.",

  // ---- Time vocabulary (TimeBadge + rails share these) ----------------------
  "common.min": "m",
  "common.h": "h",
  "common.claimed": "Recipe says",
  "common.really": "Really takes",
  "common.stepCount": "{n} steps",

  // ---- Auth surface used by foundation chrome -------------------------------
  "common.signIn": "Sign in",
  "common.signOut": "Sign out",

  // ---- Not-found (foundation NotFound page) ---------------------------------
  "common.notFoundTitle": "Page not found",
  "common.notFoundBody": "The page you're looking for doesn't exist.",
  "common.goHome": "Go home",

  // ---- Placeholder stub pages (foundation scaffolding, removed per slice) ----
  "common.sliceStub": "This slice isn't implemented yet.",
};
