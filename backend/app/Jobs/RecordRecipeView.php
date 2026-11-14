<?php

namespace App\Jobs;

use App\Models\RecipeView;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Off-hot-path view-counter write for RecipeController::show.
 *
 * The detail endpoint used to run RecipeView::firstOrCreate inline (a
 * SELECT+INSERT on every authenticated view, adding latency to the read).
 * The job performs the exact same firstOrCreate — same attributes, so
 * repeat views of the same recipe in the same month still don't
 * double-count (informational only, no limit enforced).
 *
 * month_key is resolved at DISPATCH time so the ledger row lands in the
 * month the view actually happened, even if the queue lags across a month
 * boundary. Runs inline on QUEUE_CONNECTION=sync (dev/tests) exactly like
 * the old inline write.
 */
class RecordRecipeView implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $userId,
        public int $recipeId,
        public string $monthKey,
    ) {}

    public function handle(): void
    {
        RecipeView::firstOrCreate([
            'user_id' => $this->userId,
            'recipe_id' => $this->recipeId,
            'month_key' => $this->monthKey,
        ]);
    }
}
