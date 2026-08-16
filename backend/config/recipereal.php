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

];
