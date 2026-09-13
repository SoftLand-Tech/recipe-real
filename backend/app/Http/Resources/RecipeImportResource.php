<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecipeImportResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'source_kind' => $this->source_kind,
            'source_platform' => $this->source_platform,
            'source_url' => $this->source_url,
            'provider' => $this->provider,
            'provider_model' => $this->provider_model,
            'stage' => $this->stage,
            'progress' => (int) $this->progress,
            'draft' => $this->draft,
            'warnings' => $this->warnings ?? [],
            'confidence' => $this->confidence,
            'error' => $this->error_code === null ? null : [
                'code' => $this->error_code,
                'message' => $this->error_message,
            ],
            'recipe_id' => $this->recipe_id,
            'created_at' => $this->created_at,
            'processed_at' => $this->processed_at,
            'expires_at' => $this->expires_at,
        ];
    }
}
