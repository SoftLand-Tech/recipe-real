<?php

namespace App\Console\Commands;

use App\Models\RecipeImport;
use App\Services\RecipeImport\RecipeImportStorage;
use Illuminate\Console\Command;

class PruneRecipeImports extends Command
{
    protected $signature = 'recipereal:prune-recipe-imports';

    protected $description = 'Delete expired recipe import drafts and their private source media.';

    public function handle(RecipeImportStorage $storage): int
    {
        $count = 0;

        RecipeImport::query()
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->whereNull('recipe_id')
            ->chunkById(100, function ($imports) use ($storage, &$count): void {
                foreach ($imports as $import) {
                    $storage->deleteAssets($import->source_assets ?: []);
                    $import->delete();
                    $count++;
                }
            });

        $this->info("Pruned {$count} expired recipe import(s).");

        return self::SUCCESS;
    }
}
