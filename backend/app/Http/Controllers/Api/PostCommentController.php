<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostCommentRequest;
use App\Http\Resources\PostCommentResource;
use App\Models\Post;
use App\Models\PostComment;
use App\Support\HalalGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Threaded conversation under community posts. Reads are public; writes
 * are authed and halal-gated like all community text.
 */
class PostCommentController extends Controller
{
    /**
     * Paginated comments (20/page, oldest first — thread order).
     */
    public function index(Request $request, Post $post): AnonymousResourceCollection
    {
        $comments = PostComment::query()
            ->where('post_id', $post->id)
            ->with('user:id,display_name,name,avatar_url')
            ->oldest('id')
            ->paginate(20);

        return PostCommentResource::collection($comments);
    }

    /**
     * Comment on a post (authed).
     */
    public function store(StorePostCommentRequest $request, Post $post): JsonResponse
    {
        $body = $request->string('body')->toString();

        $terms = HalalGate::scan([$body]);
        if ($terms !== []) {
            throw new HttpResponseException(response()->json([
                'message' => 'Comments cannot contain haram ingredients or alcohol references.',
                'terms' => $terms,
            ], 422));
        }

        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'body' => $body,
        ]);
        $comment->load('user:id,display_name,name,avatar_url');

        return (new PostCommentResource($comment))
            ->response()
            ->setStatusCode(201);
    }
}
