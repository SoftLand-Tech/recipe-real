<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Arabic translation pipeline (recipereal:translate-ar)
    |--------------------------------------------------------------------------
    |
    | Translations go through the MyMemory free API, whose quota (~50k source
    | characters/day) attaches to the `de` contact email. Several emails are
    | rotated by the command as each one reports exhaustion, so the effective
    | daily allowance is roughly 50k x number of emails.
    |
    */

    // Max source characters translated per run, across all emails.
    // 'google-free' (default; unofficial keyless endpoint, best Arabic, no IP walls)
    // or 'mymemory' (email-quotas — NOTE: durably 429-blocks datacenter IPs).
    'translate_driver' => env('TRANSLATE_DRIVER', 'google-free'),

    'translate_daily_budget' => env('TRANSLATE_DAILY_BUDGET', 140000),

    // Comma-separated MyMemory contact emails (quota rotation pool).
    'translate_emails' => env('TRANSLATE_EMAILS', 'mamounprogrammer@gmail.com,imnotchoun@gmail.com,kohg60416@gmail.com'),
    /*
    |--------------------------------------------------------------------------
    | Android App Links + Play Store
    |--------------------------------------------------------------------------
    |
    | app_links_sha256: comma-separated SHA-256 cert fingerprints of every
    |   keystore that signs release/preview builds (served in
    |   /.well-known/assetlinks.json for Android domain verification).
    | android_package: the applicationId of the app.
    | play_store_url: when set AND the visitor is an Android browser (not a
    |   link-preview crawler, not desktop/iOS), the share pages /r and /p
    |   302-redirect here — the store-first fallback for users without the
    |   app. Empty until the Play listing exists.
    |
    */

    'app_links_sha256' => env('APP_LINKS_SHA256', ''),

    'android_package' => env('ANDROID_PACKAGE', 'com.recipereal.app'),

    'play_store_url' => env('PLAY_STORE_URL', ''),

    /*
    |--------------------------------------------------------------------------
    | Typesense search engine (bilingual EN/AR recipe search)
    |--------------------------------------------------------------------------
    |
    | Optional search backend. When api_key is empty the feature is DISABLED:
    | every code path no-ops and search falls back to the SQLite FTS5 index
    | (local dev has no daemon). Prod runs Typesense on the VPS loopback
    | (127.0.0.1:8108). All HTTP goes through Laravel's Http facade with tight
    | timeouts — an unreachable daemon degrades to FTS5, never a 500.
    |
    */

    'typesense' => [
        'host' => env('TYPESENSE_HOST', '127.0.0.1'),
        'port' => (int) env('TYPESENSE_PORT', 8108),

        // Empty = disabled: zero HTTP calls attempted anywhere.
        'api_key' => env('TYPESENSE_API_KEY', ''),

        'collection' => env('TYPESENSE_COLLECTION', 'recipes'),

        // Call budgets in milliseconds; a slow daemon costs less than the
        // FTS5 path it is supposed to beat.
        'timeout_ms' => (int) env('TYPESENSE_TIMEOUT_MS', 1500),
        'connect_timeout_ms' => (int) env('TYPESENSE_CONNECT_TIMEOUT_MS', 700),
    ],

    /*
    |--------------------------------------------------------------------------
    | AI recipe imports
    |--------------------------------------------------------------------------
    |
    | The application owns the import lifecycle and draft schema. Media
    | resolution and AI extraction are adapters so a provider can be changed
    | without changing the mobile/admin clients.
    |
    */

    'imports' => [
        'enabled' => (bool) env('RECIPE_IMPORTS_ENABLED', true),
        'disk' => env('RECIPE_IMPORT_DISK', 'local'),
        'max_video_mb' => (int) env('RECIPE_IMPORT_MAX_VIDEO_MB', 100),
        'max_image_mb' => (int) env('RECIPE_IMPORT_MAX_IMAGE_MB', 8),
        'max_images' => (int) env('RECIPE_IMPORT_MAX_IMAGES', 6),
        'expires_hours' => (int) env('RECIPE_IMPORT_EXPIRES_HOURS', 24),
    ],

    'media_resolver' => [
        // Optional resolver service. It may use public Telegram bots or any
        // other permitted provider without putting those credentials in the
        // RecipeReal app or mobile binary.
        'url' => env('RECIPE_MEDIA_RESOLVER_URL', ''),
        'token' => env('RECIPE_MEDIA_RESOLVER_TOKEN', ''),
        'timeout' => (int) env('RECIPE_MEDIA_RESOLVER_TIMEOUT', 45),
    ],

    'ai' => [
        'default' => env('RECIPE_AI_PROVIDER', 'custom'),

        // Client-supplied provider selection is IGNORED while false (the
        // configured default is used instead). Admin-only escape hatch for
        // controlled rollouts; never enable for the public API.
        'allow_client_provider' => (bool) env('RECIPE_AI_ALLOW_CLIENT_PROVIDER', false),

        'inline_max_bytes' => (int) env('RECIPE_AI_INLINE_MAX_BYTES', 20 * 1024 * 1024),
        'providers' => [
            // protocol can be generic, openai_compatible, anthropic, or
            // gemini. Additional named providers can be added in config and
            // selected by RECIPE_AI_PROVIDER without app changes.
            'custom' => [
                'driver' => 'http',
                'protocol' => env('RECIPE_AI_PROTOCOL', 'generic'),
                'endpoint' => env('RECIPE_AI_ENDPOINT', ''),
                'api_key' => env('RECIPE_AI_API_KEY', ''),
                'model' => env('RECIPE_AI_MODEL', ''),
                'timeout' => (int) env('RECIPE_AI_TIMEOUT', 180),
            ],
            'agy' => [
                'driver' => 'agy',
                'binary' => env('RECIPE_AI_CLI_BINARY', 'agy'),
                'model' => env('RECIPE_AI_CLI_MODEL', 'gemini-3.8-flash-high'),
                'effort' => env('RECIPE_AI_CLI_EFFORT', 'high'),
                'timeout' => (int) env('RECIPE_AI_CLI_TIMEOUT', 600),
                'print_timeout' => env('RECIPE_AI_CLI_PRINT_TIMEOUT', '10m'),
                // Default OFF: the CLI must never run with escalated
                // permissions on the prod queue host. Only an operator who
                // understands the prompt-injection risk should set the env.
                'dangerously_skip_permissions' => (bool) env('RECIPE_AI_CLI_DANGEROUSLY_SKIP_PERMISSIONS', false),
                'workspace_root' => env('RECIPE_AI_CLI_WORKSPACE', ''),
                'max_output_bytes' => (int) env('RECIPE_AI_CLI_MAX_OUTPUT_BYTES', 2 * 1024 * 1024),
            ],
        ],
    ],

];
