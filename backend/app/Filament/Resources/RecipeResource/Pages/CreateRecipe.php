<?php

namespace App\Filament\Resources\RecipeResource\Pages;

use App\Filament\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex;
use Filament\Resources\Pages\CreateRecord;

class CreateRecipe extends CreateRecord
{
    protected static string $resource = RecipeResource::class;

    /**
     * Keep the contentless FTS5 index in sync (new title/ingredients/
     * description are indexed by the queued full rebuild, mirroring the
     * dispatch UserRecipeController makes on writes).
     */
    protected function afterCreate(): void
    {
        $this->record->recalculateReality();

        RebuildSearchIndex::dispatch();
    }
}