<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\RecipeCardResource;
use App\Models\Follow;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use App\Support\HalalGate;
use App\Support\ShareCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
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

        // PUBLIC identity only: the internal users.name and gender never
        // leave the account (privacy hardening H4). Authed /users/me/*
        // endpoints keep the full payload (see show()/update()).
        return response()->json(array_merge($this->payload($user, publicOnly: true), [
            'is_following' => $following,
            'is_self' => $me ? $me->id === $user->id : false,
        ]));
    }

    /**
     * Public paginated list of recipes owned by the given user.
     */
    public function recipes(Request $request, User $user): AnonymousResourceCollection
    {
        $recipes = Recipe::query()
            ->where('owner_id', $user->id)
            ->select(RecipeCardResource::COLUMNS)
            ->latest('id')
            ->paginate(20);

        return RecipeCardResource::collection($recipes);
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
                $terms = HalalGate::scan([(string) $bio]);
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

        // display_name/avatar_url render on every /p/{id} the user authored
        // (card + og:title) — forget those share pages when either moved.
        if ($user->wasChanged(['display_name', 'avatar_url', 'name'])) {
            ShareCache::forgetPostsByUser($user->id);
        }

        return response()->json($this->payload($user->refresh()));
    }

    /**
     * Profile payload. $publicOnly strips the internal account fields
     * (users.name, gender) — anything reachable WITHOUT the user's own
     * token must never carry them; the authed /users/me endpoints keep
     * the full shape the mobile client already relies on.
     */
    private function payload(User $user, bool $publicOnly = false): array
    {
        $followersCount = (int) Follow::where('followed_id', $user->id)->count();
        $followingCount = (int) Follow::where('follower_id', $user->id)->count();

        $identity = [
            'id' => $user->id,
            'display_name' => $user->display_name ?? $user->name,
            // Raw marker (no name fallback): onboarding gates on this —
            // fresh Google accounts have display_name NULL until the
            // user types one in /onboarding.
            'has_display_name' => $user->display_name !== null && $user->display_name !== '',
        ];

        if ($publicOnly) {
            // Public identity = display_name only, with a neutral fallback
            // for accounts that never set one (EN/AR aware for the share
            // pages' locale).
            $identity['display_name'] = trim((string) ($user->display_name ?? '')) !== ''
                ? $user->display_name
                : (app()->getLocale() === 'ar' ? 'طاهٍ' : 'A cook');
        } else {
            $identity['name'] = $user->name;
            $identity['email'] = $user->email;
            $identity['gender'] = $user->gender;
        }

        return [
            'user' => $identity + [
                'avatar_url' => $user->avatar_url,
                'bio' => $user->bio,
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
