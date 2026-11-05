<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Retention: analytics events are only kept for 90 days.
Schedule::command('recipereal:prune-events')->daily();
Schedule::command('recipereal:prune-recipe-imports')->hourly();

// Retention: install heartbeats die after 180 quiet days; public-form
// messages (contact + deletion requests, reader PII) after 12 months.
Schedule::command('recipereal:prune-installs')->daily();
Schedule::command('recipereal:prune-contact-messages')->daily();

// Arabic translations: nightly after the analytics prune (MyMemory's free
// daily quota resets overnight).
// DISABLED 2026-08-16: the agy batch pipeline (recipereal-work/PROMPT-500.md)
// now produces far better Arabic + step estimates; re-enable only if the
// manual pipeline stops and the nightly fallback is wanted again.
// Schedule::command('recipereal:translate-ar')->daily()->at('02:00');

// Keep the FTS index fresh after any bulk writes (imports/translations).
Schedule::command('recipereal:rebuild-search')->daily()->at('03:00');

// Typesense reindex after the FTS rebuild: heals drift from bulk writes
// that bypass the write-through sync (ai-apply, wipe-unreviewed). No-op
// when TYPESENSE_API_KEY is unset.
Schedule::command('recipereal:reindex-typesense')->daily()->at('03:30');
