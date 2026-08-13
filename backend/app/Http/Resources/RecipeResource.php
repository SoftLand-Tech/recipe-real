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
            'recipe_steps' => RecipeStepResource::collection($this->whenLoaded('recipeSteps')),
        ];
    }
}
