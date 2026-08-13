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
            'step_type' => $this->step_type,
            'publisher_minutes' => $this->whenNotNull($this->publisher_minutes),
            'community_minutes' => $this->whenNotNull($this->community_avg_minutes),
        ];
    }
}
