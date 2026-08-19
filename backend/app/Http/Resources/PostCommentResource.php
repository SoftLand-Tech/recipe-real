<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostCommentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'post_id' => $this->post_id,
            'body' => $this->body,
            'user' => new UserPublicResource($this->whenLoaded('user')),
            // Author edited the body after posting (update bumps updated_at
            // past created_at; legacy rows with NULL updated_at read false).
            'edited' => (bool) ($this->updated_at?->ne($this->created_at) ?? false),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
