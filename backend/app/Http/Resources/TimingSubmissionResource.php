<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TimingSubmissionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recipe_step_id' => $this->recipe_step_id,
            'actual_minutes' => $this->actual_minutes,
            'session_id' => $this->session_id,
            'created_at' => $this->created_at,
        ];
    }
}
