<?php

namespace App\Filament\Resources\RecipeResource\Pages;

use App\Filament\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex;
use App\Support\CommunityFeedCache;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Support\Facades\Log;
use Throwable;

class CreateRecipe extends CreateRecord
{
    protected static string $resource = RecipeResource::class;

    /**
     * Keep the contentless FTS5 index in sync (new title/ingredients/
     * description are indexed by the queued full rebuild, mirroring the
     * dispatch UserRecipeController makes on writes). Timing caches, share
     * pages and the Typesense doc follow the same freshness the API paths
     * provide.
     */
    protected function afterCreate(): void
    {
        $this->record->recalculateReality();

        RebuildSearchIndex::dispatch();

        CommunityFeedCache::bumpTiming();
        ShareCache::forgetRecipe($this->record->id);

        try {
            $typesense = app(TypesenseSearch::class);

            if ($typesense->enabled()) {
                $typesense->upsertDocs([$typesense->documentFor($this->record->fresh())]);
            }
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => 'admin-create',
                'recipe_id' => $this->record->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}