<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserPublicResource;
use App\Models\Follow;
use App\Models\User;
use App\Support\CommunityFeedCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    public function store(Request $request, User $user): JsonResponse
    {
        $me = $request->user();
        if ($me->id === $user->id) {
            return response()->json(['message' => 'You cannot follow yourself.'], 422);
        }

        Follow::firstOrCreate([
            'follower_id' => $me->id,
            'followed_id' => $user->id,
        ]);

        // Feed rows carry user.followed_by_me and the suggested ranking
        // scores follows — the follower must see the new state on refresh.
        CommunityFeedCache::bump($me->id);

        return response()->json(['following' => true, 'followers_count' => $this->followersCount($user->id)], 201);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        Follow::query()
            ->where('follower_id', $request->user()->id)
            ->where('followed_id', $user->id)
            ->delete();

        CommunityFeedCache::bump($request->user()->id);

        return response()->json(['following' => false, 'followers_count' => $this->followersCount($user->id)]);
    }

    public function followers(User $user): JsonResponse
    {
        $rows = Follow::query()
            ->where('followed_id', $user->id)
            ->with('follower:id,display_name,name,avatar_url')
            ->latest('id')
            ->paginate(20);

        $users = $rows->getCollection()->map(fn (Follow $f) => $f->follower)->filter();

        return response()->json([
            'data' => UserPublicResource::collection($users)->toArray(request()),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    public function following(User $user): JsonResponse
    {
        $rows = Follow::query()
            ->where('follower_id', $user->id)
            ->with('followed:id,display_name,name,avatar_url')
            ->latest('id')
            ->paginate(20);

        $users = $rows->getCollection()->map(fn (Follow $f) => $f->followed)->filter();

        return response()->json([
            'data' => UserPublicResource::collection($users)->toArray(request()),
            'meta' => [
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
            ],
        ]);
    }

    private function followersCount(int $userId): int
    {
        return (int) Follow::where('followed_id', $userId)->count();
    }
}
