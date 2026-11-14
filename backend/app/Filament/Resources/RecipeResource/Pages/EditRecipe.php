<?php

namespace App\Filament\Resources\RecipeResource\Pages;

use App\Filament\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex;
use App\Support\CommunityFeedCache;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Log;
use Throwable;

class EditRecipe extends EditRecord
{
    protected static string $resource = RecipeResource::class;

    /**
     * Keep the contentless FTS5 index in sync after an edit — title/
     * ingredients/description cannot be updated in place on the contentless
     * table, so a queued full rebuild is the honest option (same dispatch
     * the API's UserRecipeController makes on updates). Admin edits also
     * move categories/ratings/times, so the shared timing caches, the
     * recipe's share page (+ attached post cards) and the Typesense doc are
     * refreshed here too — the same freshness the API write paths provide.
     */
    protected function afterSave(): void
    {
        $this->record->recalculateReality();

        RebuildSearchIndex::dispatch();

        CommunityFeedCache::bumpTiming();
        ShareCache::forgetRecipe($this->record->id);
        $this->syncSearchUpsert();
    }

    /** Best-effort Typesense write-through (never fails the admin save). */
    private function syncSearchUpsert(): void
    {
        try {
            $typesense = app(TypesenseSearch::class);

            if (! $typesense->enabled()) {
                return;
            }

            $typesense->upsertDocs([$typesense->documentFor($this->record->fresh())]);
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => 'admin-upsert',
                'recipe_id' => $this->record->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
