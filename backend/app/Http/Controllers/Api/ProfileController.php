<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Models\Follow;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json($this->payload($request->user()));
    }

    public function showPublic(Request $request, User $user): JsonResponse
    {
        $me = $request->user('sanctum');
        $following = $me ? Follow::where('follower_id', $me->id)->where('followed_id', $user->id)->exists() : false;

        return response()->json(array_merge($this->payload($user), [
            'is_following' => $following,
            'is_self' => $me ? $me->id === $user->id : false,
        ]));
    }

    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        if (array_key_exists('display_name', $data)) {
            $user->display_name = $request->string('display_name')->toString();
        }
        if (array_key_exists('bio', $data)) {
            $bio = $request->input('bio');
            if ($bio !== null && $bio !== '') {
                // Bio is PUBLIC user text — same halal gate as posts,
                // comments and notes (reject with the offending terms).
                $terms = \App\Support\HalalGate::scan([(string) $bio]);
                if ($terms !== []) {
                    return response()->json([
                        'message' => 'Bio cannot contain haram ingredients or alcohol references.',
                        'terms' => $terms,
                    ], 422);
                }
            }
            $user->bio = $bio !== null && $bio !== '' ? (string) $bio : null;
        }
        if (array_key_exists('avatar_url', $data)) {
            $av = $request->input('avatar_url');
            $user->avatar_url = $av !== null && $av !== '' ? (string) $av : null;
        }
        if (array_key_exists('gender', $data)) {
            $gender = $request->input('gender');
            $user->gender = $gender === 'male' || $gender === 'female' ? $gender : null;
        }
        $user->save();

        return response()->json($this->payload($user->refresh()));
    }

    private function payload(User $user): array
    {
        $followersCount = (int) Follow::where('followed_id', $user->id)->count();
        $followingCount = (int) Follow::where('follower_id', $user->id)->count();

        return [
            'user' => [
                'id' => $user->id,
                'display_name' => $user->display_name ?? $user->name,
                'name' => $user->name,
                'avatar_url' => $user->avatar_url,
                'bio' => $user->bio,
                'gender' => $user->gender,
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
                'followers' => $followersCount,
                'following' => $followingCount,
            ],
        ];
    }
}
