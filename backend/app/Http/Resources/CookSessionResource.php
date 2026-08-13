<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CookSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recipe' => $this->whenLoaded('recipe', fn () => [
                'id' => $this->recipe->id,
                'title' => $this->recipe->title,
                'community_avg_minutes' => $this->recipe->community_avg_minutes,
            ]),
            'total_actual_minutes' => $this->total_actual_minutes,
            'cleanup_minutes' => $this->cleanup_minutes,
            'feedback' => $this->feedback,
            'created_at' => $this->created_at,
        ];
    }
}
