<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Ops machine endpoints
    |--------------------------------------------------------------------------
    |
    | Static bearer token for the local dedup workbench's sync client
    | (POST /api/ops/import-recipes). Empty token = endpoint refuses
    | everything (401) — set OPS_IMPORT_TOKEN on the VPS to enable.
    |
    */

    'import_token' => env('OPS_IMPORT_TOKEN', ''),

];
