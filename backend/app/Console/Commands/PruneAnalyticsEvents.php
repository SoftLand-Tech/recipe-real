<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use Illuminate\Console\Command;

class PruneAnalyticsEvents extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'recipereal:prune-events';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Delete analytics events older than 90 days (retention prune).';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $deleted = AnalyticsEvent::query()
            ->where('created_at', '<', now()->subDays(90))
            ->delete();

        $this->info("Pruned {$deleted} analytics event(s) older than 90 days.");

        return self::SUCCESS;
    }
}
