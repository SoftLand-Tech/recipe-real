<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'body' => $this->body,
            'image_url' => $this->image_url,
            'user' => new UserPublicResource($this->whenLoaded('user')),
            // Light recipe card (id/title/title_ar/image_url), null when the
            // post is not attached to one. Controllers constrain the eager
            // load to exactly those columns.
            'recipe' => $this->whenLoaded('recipe', fn () => $this->recipe !== null ? [
                'id' => $this->recipe->id,
                'title' => $this->recipe->title,
                'title_ar' => $this->recipe->title_ar,
                'image_url' => $this->recipe->image_url,
            ] : null),
            'likes_count' => (int) ($this->likes_count ?? $this->likes()->count()),
            'comments_count' => (int) ($this->comments_count ?? $this->comments()->count()),
            // Marked on the model by PostController::index for the resolved
            // sanctum user; false for guests.
            'liked_by_me' => (bool) ($this->liked_by_me ?? false),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
