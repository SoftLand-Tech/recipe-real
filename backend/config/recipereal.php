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

];
