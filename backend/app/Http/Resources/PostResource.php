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
        // Effective image list: `images` JSON column when non-empty, else
        // fall back to the legacy `image_url` single column when set.
        $jsonImages = is_array($this->images) ? array_values(array_filter($this->images)) : [];
        $effectiveImages = count($jsonImages) > 0
            ? $jsonImages
            : ($this->image_url ? [$this->image_url] : []);

        return [
            'id' => $this->id,
            'body' => $this->body,
            'image_url' => $this->image_url,
            // Array of image URLs (1–6 entries, or empty). New clients use
            // this; old clients keep reading image_url (first image).
            'images' => $effectiveImages,
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
            // Newest comment embed (drives the feed's latest-comment preview
            // without a per-post fetch). Eager-loaded as latestComment by
            // PostController::index/show; null when the post has no comments,
            // and omitted entirely on payloads that never loaded the relation
            // (e.g. store responses — a fresh post has none anyway).
            'latest_comment' => $this->whenLoaded('latestComment', function () {
                $comment = $this->latestComment;

                if ($comment === null) {
                    return null;
                }

                return [
                    'id' => $comment->id,
                    'body' => $comment->body,
                    'created_at' => $comment->created_at?->toIso8601String(),
                    'user' => $comment->relationLoaded('user')
                        ? new UserPublicResource($comment->user)
                        : null,
                ];
            }),
            // Author edited the body after publishing (update bumps
            // updated_at past created_at).
            'edited' => (bool) ($this->updated_at?->ne($this->created_at) ?? false),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
