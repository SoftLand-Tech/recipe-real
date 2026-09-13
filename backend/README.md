<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

## AI recipe imports

The app now supports private, queued recipe extraction from a public URL or an
uploaded image/video. Imports are stored as short-lived review drafts and do
not become public recipes until the owner or an admin edits and publishes the
draft.

### Deployment checklist

1. Run the migrations with `php artisan migrate`.
2. Configure either the HTTP provider (`RECIPE_AI_ENDPOINT`,
   `RECIPE_AI_API_KEY`, `RECIPE_AI_MODEL`, and `RECIPE_AI_PROTOCOL`) or the
   local `agy` provider described below. HTTP protocols are `generic`,
   `openai_compatible`, `anthropic`, and `gemini`.
3. Run a queue worker. Extraction is performed by `ProcessRecipeImport`; the
   mobile client polls `/api/recipe-imports/{id}` until the draft is ready.
4. Configure `RECIPE_MEDIA_RESOLVER_URL` when social URLs need a downloader or
   frame/audio resolver. The adapter receives `{url, platform}` and may return
   `media`, `media_url`, `media_urls`, `thumbnail_url`, and `metadata`.

For the `generic` AI protocol, the endpoint receives the original URL, resolver
media, optional transcript, and uploaded assets (small assets include
`data_base64`; larger assets remain private metadata). This is the recommended
integration point for video-capable or self-hosted vision/audio models.

The AI adapter is expected to return JSON containing `title`, `ingredients`,
`steps`, and `total_time_minutes`; optional timing, Arabic, nutrition,
confidence, cover, and attribution fields are normalized before review. The
prompt explicitly handles both speech transcription and no-voice visual
inspection. Private uploads are deleted after successful extraction; failed
imports are removed by the hourly `recipereal:prune-recipe-imports` schedule.

### Local agy worker

For local testing without an AI API key, set `RECIPE_AI_PROVIDER=agy`. The
provider runs the locally authenticated `agy` CLI from the queue worker and
pins `gemini-3.8-flash-high` by default:

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

Authenticate `agy` interactively once, then run Laravel's queue worker as the
same operating-system user:

```bash
agy
php artisan queue:work --tries=2 --timeout=660
```

Each job is staged in a disposable workspace outside the Laravel directory.
The dangerous permission flag is intentionally opt-in through configuration;
it grants the agent permission to run tools, so this local harness must not be
used with a production application, production secrets, or untrusted uploads.

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

In addition, [Laracasts](https://laracasts.com) contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

You can also watch bite-sized lessons with real-world projects on [Laravel Learn](https://laravel.com/learn), where you will be guided through building a Laravel application from scratch while learning PHP fundamentals.

## Agentic Development

Laravel's predictable structure and conventions make it ideal for AI coding agents like Claude Code, Cursor, and GitHub Copilot. Install [Laravel Boost](https://laravel.com/docs/ai) to supercharge your AI workflow:

```bash
composer require laravel/boost --dev

php artisan boost:install
```

Boost provides your agent 15+ tools and skills that help agents build Laravel applications while following best practices.

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
