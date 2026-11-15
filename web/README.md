# RecipeReal Web

The web client for users who will NOT install the Android app. Same backend
(`/api/*`), same Google-only auth, EN/AR + RTL parity with mobile. Served
same-origin at **`/app`** by Laravel (built into `backend/public/app`).
Online-first — no offline SQLite.

## Development

```bash
cd web
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

Assumptions the dev server makes:

- **API proxy**: `/api` is proxied to `http://127.0.0.1:8000` — start the
  backend with `php artisan serve` (from `backend/`) before developing.
- **Do not test the built app through `php artisan serve`**: artisan serve's
  dev router serves `public/app/index.html` as a static directory index (no
  `__GOOGLE_CLIENT_ID__` replacement) and 404s `/app/*` deep links itself.
  That's a dev-server artifact — the Laravel route handles everything when
  requests actually reach it (verified through the HTTP kernel; production
  nginx → php-fpm exercises the same path). Develop with `npm run dev`; if
  you must test a production build locally, use a real web server pointed
  at `backend/public` with Laravel front-controller routing.
- **Google client ID**: `index.html` ships a `__GOOGLE_CLIENT_ID__`
  placeholder that Laravel replaces at serve time. In dev it survives
  unreplaced, so put your client ID in `web/.env.local`:

  ```
  VITE_GOOGLE_CLIENT_ID=1234-abc.apps.googleusercontent.com
  ```

  (`auth/google.ts` prefers `window.__RECIPEREAL__.googleClientId`, then this
  fallback.)

## Build & serving

```bash
npm run build      # → ../backend/public/app (emptyOutDir wipes ONLY that dir)
```

`backend/routes/web.php` serves `public/app/index.html` at `/app/{any?}`
(name `app.spa`) with `__GOOGLE_CLIENT_ID__` replaced from
`config('services.google.client_id')`; a missing build returns a 503
explainer. `deploy.sh` runs this build before warming caches. Deep links
(`/app/recipe/42`) are handled client-side by React Router (basename
`/app`); assets resolve under `/app/assets/`.

Scripts: `dev` · `build` · `lint` (eslint, flat config) · `typecheck`
(`tsc --noEmit`). CI (`.github/workflows/web.yml`) runs typecheck → lint →
build on PRs touching `web/**`, the serving route, or deploy.sh.

## Architecture contracts (binding — read before contributing)

- **All API calls** go through `src/api/http.ts` (axios, `baseURL '/api'`,
  bearer token from localStorage `rr_token`). Never call axios/fetch
  directly in a component. On 401 the http layer clears the token and fires
  the **`rr:auth-expired`** window event — AuthContext handles it; slice
  code never handles 401 itself.
- **Types** live in `src/api/types.ts` (ported field-for-field from
  `mobile/src/types.ts`). If a type is missing, add it there (foundation
  review) — never duplicate types in slice files.
- **Auth**: `useAuth()` from `src/auth/AuthContext.tsx`. Gate write UI on it
  (e.g. like buttons prompt sign-in when anon); public reads must work
  signed-out. `<RequireAuth>` wraps routes that need an account.
- **Favorites** are device-local (localStorage `rr_favorites_v1`) — there is
  NO backend favorites endpoint.

## i18n & RTL conventions

- Every user-visible string goes through `t()` (`useT()` from `src/i18n`).
  Dictionaries are flat `Record<string, string>` with `{placeholder}`
  interpolation, one file per namespace per language in
  `src/i18n/dicts/<ns>.{en,ar}.ts`. The aggregator imports them all.
- Language persists in localStorage `rr_lang` (default `en`). Switching
  updates `<html lang>` and `dir` (`rtl` for Arabic) — the entire layout
  flips.
- **Use CSS logical properties only**: `ms-/me-/ps-/pe-/start-/end-`,
  `text-start`, `space-x` → `gap`. Never `ml-/mr-/pl-/pr-/left-/right-`.
  Every screen must look correct in both directions.
- Arabic must be real app-Arabic mirroring `mobile/src/i18n/ar.ts`
  terminology — not machine-literal.

## The design language

`DESIGN.md` is binding, distilled into Tailwind theme tokens in
`src/index.css`: cream grounds, white cards (hairline border, 18px radius,
whispered ink shadows), Fraunces display + DM Sans body, pill geometry for
everything interactive, generous whitespace, content capped at 1100px.

### Teal = measured time ONLY

`--color-teal` (#287C78) is reserved exclusively for **measured "really
takes" time** — `TimeBadge`'s measured pill and nothing else. It must never
style buttons, links, success states, or decoration. **Orange is the action
color.** If teal appears anywhere else, the reservation is broken. (See the
header comment in `src/index.css` and `src/components/TimeBadge.tsx`.)

## Slice ownership map

Foundation owns the skeleton; each feature slice replaces ONLY its own
files. **Never edit** `app/routes.tsx`, `app/nav.ts`, `app/AppShell.tsx`,
`api/http.ts`, `api/types.ts`, `api/auth.ts`, `api/upload.ts`,
`auth/*`, `i18n/index.tsx`, `i18n/dicts/index.ts`, or another slice's
folders.

| Area | Owned by | Files |
|---|---|---|
| Common actions, nav labels, auth strings | FOUNDATION | `i18n/dicts/{common,nav,auth}.*.ts` |
| Home rails, browse, reality index | BROWSE | `routes/browse/*`, `api/recipes.ts`, `api/home.ts`, `api/reality.ts`, dicts `{home,browse,reality}` |
| Recipe detail, cook mode, pace | RECIPE | `routes/recipe/*`, `api/cook.ts`, `api/notes.ts`, dicts `{recipe,cook,pace}` |
| Account hub, profiles, settings, notifications, favorites, follow lists | ACCOUNT | `routes/account/*`, `api/account.ts`, `api/follow.ts`, `api/notifications.ts`, `state/favorites.ts`, dicts `{account,profile,settings,notifications,favorites,follow}` |
| Feed, post detail, composer | COMMUNITY | `routes/community/*`, `api/community.ts`, dicts `{community,post,composer}` |
| Create hub, composer, AI import, my recipes | CREATE | `routes/create/*`, `api/userRecipes.ts`, `api/imports.ts`, dicts `{create,import,myRecipes}` |

Shared primitives (`src/components/`: Button, Card, Chip, Skeleton,
EmptyState, **TimeBadge**, Toast, Spinner, LanguageSwitcher) are
foundation-owned; slices may ADD new files there prefixed with their slice
name (e.g. `CommunityPostCard.tsx`).

Notes for slices:

- **Hooks linting**: `eslint-plugin-react-hooks` is intentionally absent
  (the dependency set is fixed) — be disciplined with hook deps; TypeScript
  and review cover the rest for now.
- **Cook Mode** (`/cook/:id`) currently renders inside the app shell; if the
  RECIPE slice wants a truly full-screen immersive mode it needs a route
  change in foundation — raise it, don't edit `routes.tsx`.
- Routes currently auth-gated by foundation: `/account`, `/account/profile`,
  `/notifications`, `/community/compose`, `/create/**`. Settings and
  favorites are deliberately public (signed-out states).
