<?php

namespace App\Console\Commands;

use App\Models\AppInstall;
use Illuminate\Console\Command;

/**
 * Retention prune for install heartbeats: a row is only the "how many
 * people have the app" counter while it keeps heartbeating. Anything not
 * updated for 180 days is a dead install — drop it (chunked so a large
 * backlog never builds one giant delete).
 */
class PruneAppInstalls extends Command
{
    protected $signature = 'recipereal:prune-installs';

    protected $description = 'Delete app install heartbeats not updated in 180 days (retention prune).';

    public function handle(): int
    {
        $count = 0;

        AppInstall::query()
            ->where('updated_at', '<', now()->subDays(180))
            ->chunkById(500, function ($installs) use (&$count): void {
                foreach ($installs as $install) {
                    $install->delete();
                    $count++;
                }
            });

        $this->info("Pruned {$count} app install heartbeat(s) older than 180 days.");

        return self::SUCCESS;
    }
}
