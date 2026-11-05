<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Slim public user identity for community content (notes, posts,
 * comments): never exposes email or any account field. As of the privacy
 * hardening (H4) it also never exposes users.name — the internal Google
 * account name stays on the account; public identity is display_name
 * only, with a neutral bilingual fallback for accounts that never set
 * one.
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
            'display_name' => trim((string) ($this->display_name ?? '')) !== ''
                ? $this->display_name
                : (app()->getLocale() === 'ar' ? 'طاهٍ' : 'A cook'),
            'avatar_url' => $this->avatar_url,
            'bio' => $this->bio ?? null,
            // Set on the eager-loaded model by PostController (feed follow
            // pill); false everywhere the controller didn't mark it.
            'followed_by_me' => (bool) ($this->followed_by_me ?? false),
        ];
    }
}
