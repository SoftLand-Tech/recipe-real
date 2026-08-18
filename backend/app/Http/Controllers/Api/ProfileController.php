<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The authed user's own profile: public identity + contribution counts.
 */
class ProfileController extends Controller
{
    /**
     * GET /api/users/me/profile → {user, counts}.
     */
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->payload($request->user()));
    }

    /**
     * PATCH /api/users/me/profile: update the public display name.
     */
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->display_name = $request->string('display_name')->toString();
        $user->save();

        return response()->json($this->payload($user->refresh()));
    }

    /**
     * Shared response shape for both methods.
     *
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        return [
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name ?? $user->name,
                'name' => $user->name,
                'avatar_url' => $user->avatar_url,
                'created_at' => $user->created_at?->toIso8601String(),
            ],
            'counts' => [
                'recipes' => (int) Recipe::query()->where('owner_id', $user->id)->count(),
                'public_notes' => (int) RecipeNote::query()->where('user_id', $user->id)->count(),
                'posts' => (int) Post::query()->where('user_id', $user->id)->count(),
                'likes_received' => (int) DB::table('post_likes')
                    ->join('posts', 'posts.id', '=', 'post_likes.post_id')
                    ->where('posts.user_id', $user->id)
                    ->count(),
            ],
        ];
    }
}
