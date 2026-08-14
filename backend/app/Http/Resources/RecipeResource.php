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
            'ingredients' => $this->ingredients,
            'steps' => $this->steps,
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
