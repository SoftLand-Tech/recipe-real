<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The slim list/card shape of a recipe — the fields the mobile list screens
 * (browse grid, search results, home rails, reality leaderboard) actually
 * render. Identical field names and computations to RecipeResource, minus
 * the heavy per-row payloads the full resource ships for DETAIL and SEED:
 *
 *   dropped: source_url, steps, steps_ar, ingredients_structured, keywords,
 *   description and the recipe_steps relation (lists never load it).
 *
 * The mobile SQLite cache layer is null-tolerant for absent fields, so card
 * rows hydrate fine next to full detail rows.
 */
class RecipeCardResource extends JsonResource
{
    /**
     * Every column this resource reads — the select() list for list-side
     * queries (index, search hydration, home rails, reality rows). Keep in
     * sync with toArray(): a field added below needs its column(s) here.
     * `time` reads no column (it is null unless the recipeSteps relation is
     * loaded, which list queries never do).
     */
    public const COLUMNS = [
        'id',
        'title',
        'title_ar',
        'image_url',
        'ingredients',
        'ingredients_ar',
        'aggregated_rating',
        'review_count',
        'category',
        'calories',
        'protein_g',
        'fat_g',
        'publisher_time_minutes',
        'community_avg_minutes',
        'reality_minutes',
        'reality_source',
        'reality_samples',
        'cleanup_avg_minutes',
        'dish_count',
        'grease_level',
        'dishwasher_safe',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'image_url' => $this->image_url,
            // Arabic translations, raw passthrough (null when untranslated):
            // the client picks title_ar ?? title at render — no server-side
            // field swapping, so offline caching stays simple.
            'title_ar' => $this->title_ar,
            'ingredients_ar' => $this->ingredients_ar,
            'ingredients' => $this->ingredients,
            'aggregated_rating' => $this->aggregated_rating,
            'review_count' => $this->review_count,
            'category' => $this->category,
            'calories' => $this->calories,
            'protein_g' => $this->protein_g,
            'fat_g' => $this->fat_g,
            'publisher_time_minutes' => $this->publisher_time_minutes,
            'community_avg_minutes' => $this->community_avg_minutes,
            // Reality Index: the honest duration vs the publisher's claim,
            // with a labeled source ('community' = real cook submissions,
            // 'estimate' = AI step-time sum). null while no signal exists.
            // gap_pct is a whole-number percent (null when the publisher
            // claims nothing); positive = takes longer than claimed.
            'reality' => $this->reality_minutes != null ? [
                'minutes' => (float) $this->reality_minutes,
                'source' => $this->reality_source,
                'samples' => (int) $this->reality_samples,
                'claimed_minutes' => $this->publisher_time_minutes,
                'gap_minutes' => round((float) $this->reality_minutes - $this->publisher_time_minutes, 1),
                'gap_pct' => $this->publisher_time_minutes > 0
                    ? round((((float) $this->reality_minutes - $this->publisher_time_minutes) / $this->publisher_time_minutes) * 100)
                    : null,
            ] : null,
            'cleanup_avg_minutes' => $this->cleanup_avg_minutes,
            // Cleanup estimate + factors were premium-only; ungated while the
            // premium plan is held, so every user gets the full breakdown.
            'cleanup_estimate_minutes' => $this->cleanupEstimateMinutes(),
            'cleanup_factors' => [
                'dish_count' => $this->dish_count,
                'grease_level' => $this->grease_level,
                'dishwasher_safe' => (bool) $this->dishwasher_safe,
            ],
            // Cooking-mode time contract (2026-08-18): totals derived from
            // the per-step ai_minutes the same way derive_times.py computes
            // them for the JSONL files — total includes every step (cleanup
            // included), active/passive split by step_type. null when steps
            // aren't loaded or carry no AI minutes yet. List queries never
            // load recipeSteps, so this is null on every card row — kept so
            // the card contract matches the detail payload key-for-key.
            'time' => $this->timeBreakdown(),
        ];
    }

    /**
     * Recipe-level time totals from the loaded steps relation. Mirrors
     * derive_times.py: time_total = sum of all ai_minutes, time_active /
     * time_passive = sums by step_type. Returns null when steps are not
     * loaded or none carry AI minutes (translations-only recipes).
     *
     * @return array{time_total_minutes: float, time_active_minutes: float, time_passive_minutes: float}|null
     */
    private function timeBreakdown(): ?array
    {
        if (! $this->relationLoaded('recipeSteps')) {
            return null;
        }

        $total = 0.0;
        $active = 0.0;
        $passive = 0.0;
        $hasMinutes = false;

        foreach ($this->recipeSteps as $step) {
            if ($step->ai_minutes === null) {
                continue;
            }
            $hasMinutes = true;
            $minutes = (float) $step->ai_minutes;
            $total += $minutes;
            if ($step->step_type === 'active') {
                $active += $minutes;
            } elseif ($step->step_type === 'passive') {
                $passive += $minutes;
            }
        }

        if (! $hasMinutes) {
            return null;
        }

        return [
            'time_total_minutes' => round($total),
            'time_active_minutes' => round($active),
            'time_passive_minutes' => round($passive),
        ];
    }
}
