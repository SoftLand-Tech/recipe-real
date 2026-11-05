<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        // PRIMARY client (the 2026-11 "recipereal" Cloud project). Used for
        // outbound OAuth redirects (admin panel) and as the first accepted aud.
        'client_id' => env('GOOGLE_CLIENT_ID'),
        // Secret of the PRIMARY client: lets the backend perform the
        // confidential token exchange for the PKCE flow (/auth/google/code,
        // app 1.1.0+) — the app itself never holds the secret.
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        // LEGACY client (the old project baked into distributed 1.0.2 APKs).
        // id_tokens minted for it are still ACCEPTED during the transition so
        // existing installs keep signing in; new builds ship the primary ID.
        // Remove once every distributed APK uses the primary client.
        'legacy_client_id' => env('GOOGLE_LEGACY_CLIENT_ID'),
        'admin_redirect_uri' => env('GOOGLE_ADMIN_REDIRECT_URI'),
    ],

];
