<?php

namespace App\Filament\Resources\RecipeResource\Pages;

use App\Filament\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex;
use Filament\Resources\Pages\EditRecord;

class EditRecipe extends EditRecord
{
    protected static string $resource = RecipeResource::class;

    /**
     * Keep the contentless FTS5 index in sync after an edit — title/
     * ingredients/description cannot be updated in place on the contentless
     * table, so a queued full rebuild is the honest option (same dispatch
     * the API's UserRecipeController makes on updates).
     */
    protected function afterSave(): void
    {
        $this->record->recalculateReality();

        RebuildSearchIndex::dispatch();
    }
}