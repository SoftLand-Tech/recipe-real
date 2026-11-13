<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class Recipe extends Model
{
    protected $fillable = [
        'title',
        'source_url',
        'image_url',
        // Community platform: user-created recipes (owner_id + 'user';
        // imported rows keep owner_id null / 'foodcom'). The *_ar values
        // for user recipes are written as raw JSON strings
        // (ingredients_ar/steps_ar) and plain text (title_ar), exactly how
        // the import/translate pipelines store them — no array cast, so
        // RecipeResource's raw passthrough stays consistent for both.
        'owner_id',
        'source_type',
        'title_ar',
        'ingredients_ar',
        'steps_ar',
        'ingredients',
        'steps',
        'publisher_time_minutes',
        'servings',
        'prep_time_minutes',
        'cook_time_minutes',
        'community_avg_minutes',
        'cleanup_avg_minutes',
        // Reality Index (see recalculateReality()).
        'reality_minutes',
        'reality_source',
        'reality_samples',
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
            'servings' => 'integer',
            'prep_time_minutes' => 'integer',
            'cook_time_minutes' => 'integer',
            'community_avg_minutes' => 'decimal:2',
            'cleanup_avg_minutes' => 'decimal:2',
            'reality_minutes' => 'decimal:2',
            'reality_samples' => 'integer',
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
     * Recompute this recipe's community timing aggregates from its cook
     * sessions + timing submissions, then follow the Reality Index via
     * recalculateReality(). Shared by full Cook Mode sessions (which carry
     * per-step timings) and one-tap quick-time logs (totals only).
     *
     * - community_avg_minutes: poison-resistant average of
     *   total_actual_minutes over the last 100 sessions, with every user
     *   capped at their 5 most recent rows (null-safe: untouched when
     *   there are none).
     * - cleanup_avg_minutes: same window and per-user cap over non-null
     *   cleanup_minutes.
     * - recipe_steps.community_avg_minutes: average of timing_submissions
     *   per step with the same 100-row window and per-user cap, for the
     *   given step ids (constrained to this recipe's steps). An empty list
     *   heals steps that already have submissions (e.g. sessions logged
     *   before step aggregates existed).
     *
     * Saves the model when anything changed (recalculateReality persists
     * when the reality columns moved; the averages are saved explicitly).
     */
    public function refreshCommunityTiming(array $stepIds = [], bool $recomputeSteps = true): void
    {
        // Anti-poisoning: fetch the last 100 contributing rows (same window
        // as before), then cap every user at their 5 most recent rows before
        // averaging — see cappedPerUserAverage().
        $avg = $this->cappedPerUserAverage(
            CookSession::query()
                ->where('recipe_id', $this->id)
                ->whereNotNull('total_actual_minutes')
                ->latest('id')
                ->limit(100)
                ->get(['user_id', 'total_actual_minutes']),
            'total_actual_minutes',
        );

        if ($avg !== null) {
            $this->community_avg_minutes = round($avg, 2);
        }

        $cleanupAvg = $this->cappedPerUserAverage(
            CookSession::query()
                ->where('recipe_id', $this->id)
                ->whereNotNull('cleanup_minutes')
                ->latest('id')
                ->limit(100)
                ->get(['user_id', 'cleanup_minutes']),
            'cleanup_minutes',
        );

        if ($cleanupAvg !== null) {
            $this->cleanup_avg_minutes = round($cleanupAvg, 2);
        }

        if ($recomputeSteps) {
            if ($stepIds === []) {
                $stepIds = TimingSubmission::query()
                    ->join('recipe_steps', 'recipe_steps.id', '=', 'timing_submissions.recipe_step_id')
                    ->where('recipe_steps.recipe_id', $this->id)
                    ->distinct()
                    ->pluck('timing_submissions.recipe_step_id')
                    ->all();
            }

            if ($stepIds !== []) {
                $ownedStepIds = RecipeStep::query()
                    ->where('recipe_id', $this->id)
                    ->whereIn('id', $stepIds)
                    ->pluck('id');

                foreach ($ownedStepIds as $stepId) {
                    // Same anti-poisoning cap per step: last 100 submissions,
                    // at most 5 per user before averaging.
                    $stepAvg = $this->cappedPerUserAverage(
                        TimingSubmission::query()
                            ->where('recipe_step_id', $stepId)
                            ->latest('id')
                            ->limit(100)
                            ->get(['user_id', 'actual_minutes']),
                        'actual_minutes',
                    );

                    if ($stepAvg !== null) {
                        RecipeStep::query()
                            ->where('id', $stepId)
                            ->update(['community_avg_minutes' => round($stepAvg, 2)]);
                    }
                }
            }
        }

        if ($this->isDirty()) {
            $this->save();
        }

        $this->recalculateReality();
    }

    /**
     * Anti-poisoning cap for community averages: from the already-fetched
     * rows (newest first, capped at 100 BEFORE this cut), each user_id
     * contributes at most its 5 MOST RECENT rows; the flattened capped rows
     * are then averaged. Without it one account spamming logs could dominate
     * reality_minutes — the "Really takes" data cooks trust. With it, five
     * rows is a full voice no matter how many more the account logs.
     *
     * @param  Collection<int, Model>  $rows
     */
    private function cappedPerUserAverage(Collection $rows, string $column): ?float
    {
        $contributions = $rows
            ->groupBy('user_id')
            ->flatMap(fn (Collection $userRows) => $userRows->take(5))
            ->pluck($column);

        if ($contributions->isEmpty()) {
            return null;
        }

        return (float) $contributions->avg();
    }

    /**
     * Recompute the Reality Index columns (reality_minutes /
     * reality_source / reality_samples) and save when anything changed.
     *
     * 'community': the honest real-cook average wins whenever
     * community_avg_minutes is set (feed it first — CookSessionController@
     * quickTime recomputes the average, then calls this); reality_samples
     * then counts the cook sessions it rests on. 'estimate': the sum of
     * per-step ai_minutes over non-cleanup steps, honestly labeled until
     * cooks replace it. Neither available → null reality.
     *
     * Shared by quick-time submissions and recipereal:ai-apply; the bulk
     * backfill (recipereal:backfill-reality) re-implements the same rule
     * set-based for the whole table.
     */
    public function recalculateReality(): bool
    {
        if ($this->community_avg_minutes !== null) {
            $this->reality_minutes = round((float) $this->community_avg_minutes, 2);
            $this->reality_source = 'community';
            $this->reality_samples = (int) CookSession::query()
                ->where('recipe_id', $this->id)
                ->whereNotNull('total_actual_minutes')
                ->count();
        } else {
            $estimate = (float) DB::table('recipe_steps')
                ->where('recipe_id', $this->id)
                ->where('step_type', '!=', 'cleanup')
                ->whereNotNull('ai_minutes')
                ->sum('ai_minutes');

            if ($estimate > 0) {
                $this->reality_minutes = round($estimate, 2);
                $this->reality_source = 'estimate';
            } else {
                $this->reality_minutes = null;
                $this->reality_source = null;
            }
            $this->reality_samples = 0;
        }

        if (! $this->isDirty()) {
            return false;
        }

        $this->save();

        return true;
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
            ->where('recipes.image_url', '!=', '')
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

    /**
     * The user who created this recipe (null for imported Food.com rows).
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(RecipeNote::class);
    }

    /**
     * True when this recipe was authored by a user in the app (community
     * platform). Such recipes are always kept by recipereal:wipe-unreviewed.
     */
    public function isUserAuthored(): bool
    {
        return $this->source_type === 'user';
    }
}
