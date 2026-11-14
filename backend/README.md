# RecipeReal — backend (Laravel 13)

API + marketing landing + share pages + Filament admin for [RecipeReal](../README.md). Serves the Expo client, the web landing at `/`, deep-link share pages (`/r`, `/p`, `/u`), direct-APK distribution (`/download`), and the admin panel.

**Stack:** PHP 8.4 · Laravel 13 · Sanctum auth (Google ID-token) · SQLite (dev) / SQLite + Redis queue on prod · Vite + Blade · Filament 5 admin.

## Quickstart

```bash
cp .env.example .env          # then fill DB_*, Google, RECIPE_AI_* (see below)
composer install
php artisan key:generate
php artisan migrate --force
npm install && npm run build  # landing + Filament panel assets
php artisan serve              # http://localhost:8000
php artisan queue:work --tries=2 --timeout=660   # required for AI imports
```

## What lives here

| Path | Purpose |
|---|---|
| `routes/api.php` | ~40 REST endpoints: auth, recipes, cook sessions, pace, imports, posts, follows, analytics, account deletion |
| `routes/web.php` | Landing `/`, share pages `/r/{id}` `/p/{id}` `/u/{id}`, `/download`, privacy + account-delete pages, App Links `assetlinks.json` |
| `app/Http/Controllers/Api/` | Request handling (throttled: 240/min reads, 60/min writes, 5/min auth) |
| `app/Jobs/ProcessRecipeImport.php` | Queued AI extraction worker |
| `app/Filament/` | Admin: recipes, imports, posts/moderation, cook sessions, Agy sessions, app releases |
| `app/Models/` | Recipe, RecipeStep, CookSession, PaceCalibration, Post, UserRecipe, … |
| `app/Support/ShareBanner.php` | Store/APK smart-banner logic for share pages |
| `database/` | Migrations + the 20k-recipe library pipeline (`ImportFoodcom*`, `BackfillReality`, `AuditHalalLibrary`) |
| `resources/views/` | Blade: warm kitchen-table landing, share pages, legal pages |
| `tests/` | PHPUnit feature + unit suite (`php artisan test`) |

## Key commands

```bash
php artisan test                                  # full suite
vendor/bin/pint --test                            # style gate (CI enforces)
php artisan recipereal:stats                       # funnel metrics
php artisan recipereal:audit-halal-library         # scrub non-halal community content
php artisan recipereal:backfill-reality            # rebuild claim-vs-reality stats
php artisan recipereal:prune-recipe-imports        # GC expired import drafts (also hourly via scheduler)
```

## Deploy

One command on the VPS (`/var/www/recipe-real`): `./deploy.sh` — pull → `composer install --no-dev` → Filament assets → migrate → Vite build → cache → restart queue → health-check. Full runbook: [docs/deploy.md](../docs/deploy.md).

## AI recipe imports

The app supports private, queued recipe extraction from a public URL or an uploaded image/video. Imports are stored as short-lived review drafts and do **not** become public recipes until the owner or an admin edits and publishes the draft.

### Deployment checklist

1. Run the migrations with `php artisan migrate`.
2. Configure either the HTTP provider (`RECIPE_AI_ENDPOINT`, `RECIPE_AI_API_KEY`, `RECIPE_AI_MODEL`, and `RECIPE_AI_PROTOCOL`) or the local `agy` provider described below. HTTP protocols are `generic`, `openai_compatible`, `anthropic`, and `gemini`.
3. Run a queue worker. Extraction is performed by `ProcessRecipeImport`; the mobile client polls `/api/recipe-imports/{id}` until the draft is ready.
4. Configure `RECIPE_MEDIA_RESOLVER_URL` when social URLs need a downloader or frame/audio resolver. The adapter receives `{url, platform}` and may return `media`, `media_url`, `media_urls`, `thumbnail_url`, and `metadata`.

For the `generic` AI protocol, the endpoint receives the original URL, resolver media, optional transcript, and uploaded assets (small assets include `data_base64`; larger assets remain private metadata). This is the recommended integration point for video-capable or self-hosted vision/audio models.

The AI adapter is expected to return JSON containing `title`, `ingredients`, `steps`, and `total_time_minutes`; optional timing, Arabic, nutrition, confidence, cover, and attribution fields are normalized before review. The prompt explicitly handles both speech transcription and no-voice visual inspection. Private uploads are deleted after successful extraction; failed imports are removed by the hourly `recipereal:prune-recipe-imports` schedule.

### Local agy worker

For local testing without an AI API key, set `RECIPE_AI_PROVIDER=agy`. The provider runs the locally authenticated `agy` CLI from the queue worker and pins `gemini-3.8-flash-high` by default:

```env
RECIPE_AI_PROVIDER=agy
RECIPE_AI_CLI_BINARY=/home/mamoun/.local/bin/agy
RECIPE_AI_CLI_MODEL=gemini-3.8-flash-high
RECIPE_AI_CLI_EFFORT=high
RECIPE_AI_CLI_TIMEOUT=600
RECIPE_AI_CLI_PRINT_TIMEOUT=10m
RECIPE_AI_CLI_DANGEROUSLY_SKIP_PERMISSIONS=true
RECIPE_AI_CLI_WORKSPACE=/tmp/recipereal-ai-imports
DB_QUEUE_RETRY_AFTER=720
```

Authenticate `agy` interactively once, then run Laravel's queue worker as the same operating-system user:

```bash
agy
php artisan queue:work --tries=2 --timeout=660
```

Each job is staged in a disposable workspace outside the Laravel directory. The dangerous permission flag is intentionally opt-in through configuration; it grants the agent permission to run tools, so this local harness must not be used with a production application, production secrets, or untrusted uploads.
