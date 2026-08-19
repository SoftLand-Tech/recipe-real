<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Admin panel access
    |--------------------------------------------------------------------------
    |
    | Comma-separated list of emails allowed into the /admin Filament panel.
    | Matching is case-insensitive. An empty value locks everyone out.
    |
    | Read via config() (not env()) so it survives `php artisan config:cache`.
    |
    */

    'emails' => env('ADMIN_EMAILS', ''),

];