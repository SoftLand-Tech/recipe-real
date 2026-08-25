<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Slim public user identity for community content (notes, posts,
 * comments): never exposes email or any account field.
 */
class UserPublicResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'display_name' => $this->display_name ?? $this->name,
            'name' => $this->name,
            'avatar_url' => $this->avatar_url,
            'bio' => $this->bio ?? null,
            // Set on the eager-loaded model by PostController (feed follow
            // pill); false everywhere the controller didn't mark it.
            'followed_by_me' => (bool) ($this->followed_by_me ?? false),
        ];
    }
}
