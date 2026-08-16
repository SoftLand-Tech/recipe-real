<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Retention: analytics events are only kept for 90 days.
Schedule::command('recipereal:prune-events')->daily();

// Arabic translations: nightly after the analytics prune (MyMemory's free
// daily quota resets overnight).
Schedule::command('recipereal:translate-ar')->daily()->at('02:00');

// Keep the FTS index fresh after any bulk writes (imports/translations).
Schedule::command('recipereal:rebuild-search')->daily()->at('03:00');
