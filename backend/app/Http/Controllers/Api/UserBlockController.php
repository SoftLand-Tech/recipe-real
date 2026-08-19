<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Block list management: POST /users/{user}/block hides that author's posts
 * and comments from the blocker's feeds (filtering lives in PostController
 * and PostCommentController); DELETE removes the block again.
 */
class UserBlockController extends Controller
{
    /**
     * Block a user (authed). Idempotent: firstOrCreate on the unique
     * (blocker, blocked) pair → 201 {ok:true} every time.
     */
    public function store(Request $request, User $user): JsonResponse
    {
        if ($request->user()->id === $user->id) {
            return response()->json([
                'message' => 'You cannot block yourself.',
            ], 422);
        }

        UserBlock::firstOrCreate([
            'blocker_id' => $request->user()->id,
            'blocked_id' => $user->id,
        ]);

        return response()->json(['ok' => true], 201);
    }

    /**
     * Unblock a user (authed) → 204 whether or not a block existed.
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        UserBlock::query()
            ->where('blocker_id', $request->user()->id)
            ->where('blocked_id', $user->id)
            ->delete();

        return response()->json(null, 204);
    }
}
