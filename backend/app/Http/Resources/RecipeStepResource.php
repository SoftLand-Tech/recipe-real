<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecipeStepResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'step_number' => $this->step_number,
            'description' => $this->description,
            'description_ar' => $this->description_ar,
            'step_type' => $this->step_type,
            'publisher_minutes' => $this->whenNotNull($this->publisher_minutes),
            'community_minutes' => $this->whenNotNull($this->community_avg_minutes),
            'ai_minutes' => $this->whenNotNull($this->ai_minutes),
            // Cooking-mode alarm anchor (2026-08-18 time contract): the time
            // literally stated in this step's text ("bake 45 minutes" -> 45).
            // The client offers a countdown ONLY when this is non-null; AI
            // estimates are never user-facing timers.
            'literal_minutes' => $this->whenNotNull($this->literal_minutes),
        ];
    }
}
