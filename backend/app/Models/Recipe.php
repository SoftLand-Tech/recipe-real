<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    protected $fillable = [
        'title',
        'source_url',
        'image_url',
        'ingredients',
        'steps',
        'publisher_time_minutes',
        'community_avg_minutes',
        'cleanup_avg_minutes',
        'steps_count',
        'dish_count',
        'grease_level',
        'dishwasher_safe',
        // Food.com metadata (recipereal:import-foodcom-meta).
        'aggregated_rating',
        'review_count',
        'category',
        'keywords',
        'description',
        'calories',
        'protein_g',
        'fat_g',
    ];

    protected function casts(): array
    {
        return [
            'ingredients' => 'array',
            'steps' => 'array',
            'keywords' => 'array',
            'publisher_time_minutes' => 'integer',
            'community_avg_minutes' => 'decimal:2',
            'cleanup_avg_minutes' => 'decimal:2',
            'steps_count' => 'integer',
            'dish_count' => 'integer',
            'dishwasher_safe' => 'boolean',
            // Stage A deterministic normalization (recipereal:normalize-
            // ingredients): {"v":1,"items":[{raw,qty,qty_display,unit,item,
            // prep},...]}. Array cast like ingredients/keywords; the command
            // writes the JSON via DB::table, so no double-encode risk.
            'ingredients_structured' => 'array',
            'ingredients_needs_llm' => 'boolean',
        ];
    }

    /**
     * Model-based cleanup estimate derived from the dish-burden taxonomy.
     *
     * Returns null when dish_count is not set. Otherwise combines a base
     * cleanup time with per-dish, grease, and hand-wash penalties.
     */
    public function cleanupEstimateMinutes(): ?int
    {
        if ($this->dish_count === null) {
            return null;
        }

        $dishCount = (int) $this->dish_count;

        $base = 2.0;
        $dishes = $dishCount * 1.5;

        $grease = match ($this->grease_level) {
            'high' => 4.0,
            'medium' => 2.0,
            default => 0.0,
        };

        $handwash = ($this->dishwasher_safe ? 0 : $dishCount * 1.0);

        return (int) round($base + $dishes + $grease + $handwash);
    }

    /**
     * Recipes visible in list endpoints (index, search, home rails, paged
     * seed): at least 2 steps. Keeps degenerate imports out of the app —
     * e.g. recipes whose only "step" is an un-parsed raw R vector
     * (see recipereal:fix-steps). Direct /show links keep working for any
     * recipe regardless of this scope.
     *
     * The column is table-qualified so the scope also works on queries
     * joined against recipes_fts (which has no steps_count column).
     */
    public function scopeListable(Builder $query): Builder
    {
        return $query->where('recipes.steps_count', '>=', 2);
    }

    /**
     * The quality tier surfacing rule (~51.7k of 520k rows in prod):
     * listable + has an image + aggregated_rating >= 4 + review_count >= 5.
     * Used by the Browse feed, the home rails and the paged seed endpoint
     * so the app leads with the good stuff; search keeps searching the
     * whole library and only tier-boosts its ordering.
     *
     * Columns are table-qualified like scopeListable for the same
     * joined-against-recipes_fts reason.
     */
    public function scopeQualityTier(Builder $query): Builder
    {
        return $query
            ->where('recipes.steps_count', '>=', 2)
            ->whereNotNull('recipes.image_url')
            ->where('recipes.aggregated_rating', '>=', 4)
            ->where('recipes.review_count', '>=', 5);
    }

    public function recipeSteps(): HasMany
    {
        return $this->hasMany(RecipeStep::class)->orderBy('step_number');
    }

    public function cookSessions(): HasMany
    {
        return $this->hasMany(CookSession::class);
    }
}
