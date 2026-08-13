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
        return [
            'id' => $this->id,
            'title' => $this->title,
            'source_url' => $this->source_url,
            'ingredients' => $this->ingredients,
            'steps' => $this->steps,
            'publisher_time_minutes' => $this->publisher_time_minutes,
            'community_avg_minutes' => $this->community_avg_minutes,
            'cleanup_avg_minutes' => $this->cleanup_avg_minutes,
            'cleanup_estimate_minutes' => $this->cleanupEstimateMinutes(),
            'cleanup_factors' => [
                'dish_count' => $this->dish_count,
                'grease_level' => $this->grease_level,
                'dishwasher_safe' => (bool) $this->dishwasher_safe,
            ],
            'recipe_steps' => RecipeStepResource::collection($this->whenLoaded('recipeSteps')),
        ];
    }
}
