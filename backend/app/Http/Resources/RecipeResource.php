<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecipeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        // Recipes are public for browsing, so resolve the user from the
        // sanctum guard explicitly (default guard is 'web'/session).
        $premium = auth('sanctum')->user()?->isPremium() ?? false;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'source_url' => $this->source_url,
            'image_url' => $this->image_url,
            // Arabic translations, raw passthrough (null when untranslated):
            // the client picks title_ar ?? title at render — no server-side
            // field swapping, so offline caching stays simple.
            'title_ar' => $this->title_ar,
            'ingredients_ar' => $this->ingredients_ar,
            'steps_ar' => $this->steps_ar,
            'ingredients' => $this->ingredients,
            // Stage A deterministic normalization (recipereal:normalize-
            // ingredients), raw JSON passthrough via the model's array cast
            // (null when not yet normalized): {"v":1,"items":[...]}.
            'ingredients_structured' => $this->ingredients_structured,
            'steps' => $this->steps,
            // Food.com metadata, raw nullable passthrough (keywords is an
            // array via the model cast, like ingredients).
            'aggregated_rating' => $this->aggregated_rating,
            'review_count' => $this->review_count,
            'category' => $this->category,
            'keywords' => $this->keywords,
            'description' => $this->description,
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
            'cleanup_estimate_minutes' => $premium ? $this->cleanupEstimateMinutes() : null,
            'cleanup_factors' => $premium ? [
                'dish_count' => $this->dish_count,
                'grease_level' => $this->grease_level,
                'dishwasher_safe' => (bool) $this->dishwasher_safe,
            ] : null,
            'recipe_steps' => RecipeStepResource::collection($this->whenLoaded('recipeSteps')),
        ];
    }
}
