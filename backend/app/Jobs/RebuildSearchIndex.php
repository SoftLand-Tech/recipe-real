<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;

/**
 * Rebuilds the recipes_fts contentless FTS5 index, wrapping the existing
 * recipereal:rebuild-search command.
 *
 * User-recipe writes dispatch this job: the index is contentless WITHOUT
 * contentless_delete support on the SQLite builds we target, so a changed
 * row cannot be surgically updated in place — the honest options are the
 * direct single-row INSERT used on create (UserRecipeController::store,
 * new rowid, no old row to replace) and this full rebuild for updates and
 * deletes. On the sync queue connection it runs immediately; on the
 * database/redis queue it runs async via a worker, with ShouldBeUnique
 * coalescing rapid updates within 30s.
 */
class RebuildSearchIndex implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $uniqueFor = 30;

    public function handle(): void
    {
        Artisan::call('recipereal:rebuild-search');
    }
}
