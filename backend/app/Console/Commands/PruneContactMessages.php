<?php

namespace App\Console\Commands;

use App\Models\ContactMessage;
use Illuminate\Console\Command;

/**
 * Retention prune for public-form messages (/contact + account-deletion
 * requests): they contain reader PII, so they are only kept 12 months.
 * Chunked deletes keep a large backlog from becoming one giant query.
 */
class PruneContactMessages extends Command
{
    protected $signature = 'recipereal:prune-contact-messages';

    protected $description = 'Delete contact/deletion-request messages older than 12 months (retention prune).';

    public function handle(): int
    {
        $count = 0;

        ContactMessage::query()
            ->where('created_at', '<', now()->subMonths(12))
            ->chunkById(500, function ($messages) use (&$count): void {
                foreach ($messages as $message) {
                    $message->delete();
                    $count++;
                }
            });

        $this->info("Pruned {$count} contact message(s) older than 12 months.");

        return self::SUCCESS;
    }
}
