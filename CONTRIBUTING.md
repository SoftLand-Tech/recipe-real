# Contributing to RecipeReal

Thanks for helping make cook times honest. Small, focused PRs beat big rewrites — one feature or fix per PR.

## Ground rules

1. **Facts only.** Library size is ~20,089 recipes. One public user exists (the owner). Never invent user counts, downloads, ratings, or benchmark claims in code, copy, or store listings. Placeholder quotes must stay labeled (“Early preview quotes…”).
2. **Design tokens are law.** Orange `#F26B1D` = action only. Teal `#287C78` = measured “Really takes” time inside app screens only — never links, buttons, or landing chrome. Full system: [DESIGN.md](DESIGN.md).
3. **Halal-first.** Community content, user recipes, and AI imports go through the pork & alcohol screen. Don’t weaken `haram-filter.json` or the audit command without discussion.
4. **Bilingual.** User-facing strings need EN + AR (RTL must not break). Mirror store copy rules in [store/README.md](store/README.md).

## Setup

```bash
# backend
cd backend && cp .env.example .env && composer install
php artisan key:generate && php artisan migrate --force
npm install && npm run build

# mobile
cd mobile && npm install && npx expo start
```

See the root [README](README.md), [backend/README.md](backend/README.md), and [mobile/README.md](mobile/README.md) for the full matrix.

## Branching & commits

- Branch from `main`: `feat/<area>-<slug>` · `fix/<area>-<slug>` · `chore/<slug>` · `docs/<slug>`
- Example: `feat/mobile-fridge-filter`, `fix/screen-gutters`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/) — `feat(mobile): …`, `fix(backend): …`, `chore(store): …`
- PRs target `main`. Fill in the PR template (what / why / screenshots / test plan). Link the issue with `Closes #N`.

## Quality gates (CI must pass)

| Area | Gate |
|---|---|
| backend | `composer test` (PHPUnit) + Pint (`vendor/bin/pint --test`) |
| mobile | `npx tsc --noEmit` + `npx expo lint` |

Add or update tests with behavior changes: PHPUnit feature tests for API/admin, and keep offline-cache + RTL behavior covered on mobile.

## Reviews

- One approval minimum; the owner (`@MamounHisham1`) reviews product/copy-sensitive changes.
- Keep diffs reviewable (< ~400 lines where possible). Screenshots or screen recordings are required for UI PRs.
- Never commit secrets (`.env`, keystores, `google-services.json`), generated native folders (`mobile/ios`, `mobile/android`), or local captures.

## Release flow

1. Bump `version` in `mobile/app.config.js` (+ `package.json`).
2. Build signed APK, upload via admin panel → *App releases*.
3. Smoke-test `/download`, share pages, and the Reality rails.
4. Update `store/listing-*.md` “What’s new” if user-facing changes shipped.
