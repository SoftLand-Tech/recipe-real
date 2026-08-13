# RecipeReal (mobile)

React Native + Expo (SDK 57, expo-router, TypeScript) client for the RecipeReal
MVP. Lists recipes with calibrated cook-time estimates and works offline-first
via a local SQLite cache.

## Get started

1. Install dependencies (already installed in this workspace, otherwise):

   ```bash
   npm install
   ```

2. Point the app at the backend. The base URL defaults to
   `http://localhost:8000`. To override it, set the Expo extra
   `reciperealApiBaseUrl` in `app.json`:

   ```jsonc
   {
     "expo": {
       "extra": { "reciperealApiBaseUrl": "http://10.0.2.2:8000" }
       // ^ on an Android emulator use 10.0.2.2 to reach the host's localhost
     }
   }
   ```

   The resolution lives in [`src/config.ts`](./src/config.ts) (`API_BASE_URL`).

3. Start the app:

   ```bash
   npx expo start
   ```

   Then press `a` (Android), `i` (iOS), or scan the QR code with Expo Go.

## How it works

- **Offline-first cache** (`src/db/database.ts`): on first launch the recipe list
  calls `GET /api/recipes/seed` and bulk-inserts recipes + recipe_steps into a
  local `expo-sqlite` database (WAL enabled). Subsequent launches show cached
  recipes immediately and refresh in the background.
- **API client** (`src/api/client.ts`): an axios instance with a request
  interceptor that attaches `Authorization: Bearer <token>` from AsyncStorage
  (key `recipereal.token`). Exposes `login`, `register`, `logout`, `getRecipes`,
  `getRecipe`, and `seedRecipes`.
- **Screens** (file-based routing under `src/app/`):
  - `index.tsx` — recipe list with client-side title search, pull-to-refresh,
    and loading / empty / error states.
  - `recipe/[id].tsx` — recipe detail: publisher-vs-community time summary,
    cleanup-inclusive total, ingredients, ordered `recipe_steps` with type
    badges and per-step community time, plus a placeholder "Start Cook Mode"
    button (Cook Mode is Week 2).

## Styling note

NativeWind v4 is configured (`tailwind.config.js`, `global.css`, `babel.config.js`
with the `nativewind/babel` preset, and `metro.config.js` using
`withNativeWind`). The screens themselves use React Native `StyleSheet` for
layout/colour values to keep the UI deterministic and resilient; the Tailwind
pipeline is available for any component that opts into `className`.

## EAS builds

The app is configured for [EAS Build](https://docs.expo.dev/build/introduction/)
via [`eas.json`](./eas.json). Builds require an Expo account and (for store
submissions) Apple Developer and Google Play Console accounts — these cannot be
set up from this environment.

Setup (one-time):

```bash
npm install -g eas-cli
eas login
```

Before the first build, initialize the EAS project to populate
`expo.extra.eas.projectId` in `app.json` (this step is intentionally left for you
to run — a placeholder would break EAS):

```bash
eas init
```

Profiles:

- **development** — development build (internal) with the dev client:

  ```bash
  eas build --profile development --platform ios
  eas build --profile development --platform android
  ```

- **preview** — internal beta (TestFlight internal / Play internal testing; ships
  an APK on Android and an internal iOS build) on the `preview` release channel:

  ```bash
  eas build --profile preview
  ```

- **production** — store submission on the `production` release channel:

  ```bash
  eas build --profile production --platform ios --auto-submit
  ```

