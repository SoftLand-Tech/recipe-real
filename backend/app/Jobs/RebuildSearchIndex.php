<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
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
 * database/redis queue it runs async via a worker, with
 * ShouldBeUniqueUntilProcessing coalescing queued duplicates while allowing
 * later edits to queue cleanly behind an active rebuild, paired with
 * WithoutOverlapping to serialize concurrent workers.
 */
class RebuildSearchIndex implements ShouldQueue, ShouldBeUniqueUntilProcessing
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $uniqueFor = 120;

    /**
     * @return list<object>
     */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('rebuild-search-index'))->expireAfter(120)];
    }

    public function handle(): void
    {
        Artisan::call('recipereal:rebuild-search');
    }
}
