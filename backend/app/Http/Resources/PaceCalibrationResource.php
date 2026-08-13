<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaceCalibrationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $community = (float) $this->community_avg_minutes;
        $personal = (float) $this->personal_avg_minutes;

        $multiplier = ($community > 0) ? round($personal / $community, 2) : 1.0;

        return [
            'step_type' => $this->step_type,
            'personal_avg_minutes' => $this->personal_avg_minutes,
            'community_avg_minutes' => $this->community_avg_minutes,
            'multiplier' => $multiplier,
            'confidence' => $this->confidence,
        ];
    }
}
