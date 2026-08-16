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
