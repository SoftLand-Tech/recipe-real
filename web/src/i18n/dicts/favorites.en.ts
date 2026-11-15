/**
 * Favorites screen (namespace `favorites.*`) — OWNED BY SLICE ACCOUNT.
 * Favorites are device-local (localStorage 'rr_favorites_v1', no backend
 * endpoint). Arabic mirrors mobile/src/i18n/ar.ts.
 */
export const en: Record<string, string> = {
  "favorites.pageTitle": "Favorites",
  "favorites.subtitle": "Cook again — your saved recipes",
  "favorites.count": "{n} recipes",
  "favorites.deviceLocal":
    "Saved in this browser — favorites stay on this device, even signed out.",
  "favorites.emptyTitle": "No favorites yet",
  "favorites.emptyCaption": "Press the heart on any recipe to save it here.",
  "favorites.browseRecipes": "Browse recipes",
  "favorites.removeA11y": "Remove {title} from favorites",
  "favorites.someFailed": "{n} favorites couldn't load.",
};
