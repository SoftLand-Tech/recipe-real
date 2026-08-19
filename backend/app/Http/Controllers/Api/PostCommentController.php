<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostCommentRequest;
use App\Http\Resources\PostCommentResource;
use App\Models\CommentReport;
use App\Models\Notification;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\UserBlock;
use App\Support\HalalGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Threaded conversation under community posts. Reads are public; writes
 * are authed and halal-gated like all community text. Comment authors can
 * edit/delete their own comments; any signed-in user can report one, and
 * comments authored by users the reader blocks are filtered out.
 */
class PostCommentController extends Controller
{
    /**
     * Paginated comments (20/page, oldest first — thread order). Comments
     * authored by users the sanctum user blocks are excluded.
     */
    public function index(Request $request, Post $post): AnonymousResourceCollection
    {
        $query = PostComment::query()
            ->where('post_id', $post->id)
            ->with('user:id,display_name,name,avatar_url');

        // Moderation: hide comments from authors the current user blocks.
        $user = $request->user('sanctum');
        if ($user !== null) {
            $blockedIds = UserBlock::query()
                ->where('blocker_id', $user->id)
                ->pluck('blocked_id')
                ->all();
            if ($blockedIds !== []) {
                $query->whereNotIn('user_id', $blockedIds);
            }
        }

        $comments = $query->oldest('id')->paginate(20);

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

        // Inline notification event: someone else's comment notifies the post
        // author (self-comments never notify).
        if ($post->user_id !== $request->user()->id) {
            Notification::create([
                'user_id'  => $post->user_id,
                'type'     => 'comment',
                'actor_id' => $request->user()->id,
                'post_id'  => $post->id,
            ]);
        }

        return (new PostCommentResource($comment))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update the comment's body (author-only). Validates like store and
     * re-runs the halal gate whenever the text changes; the resource then
     * reports edited: true (updated_at > created_at).
     */
    public function update(Request $request, Post $post, PostComment $comment): PostCommentResource
    {
        $this->assertInPost($post, $comment);
        $this->assertAuthor($request, $comment);

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:1000'],
        ]);

        $body = (string) $validated['body'];

        if ($body !== $comment->body) {
            $terms = HalalGate::scan([$body]);
            if ($terms !== []) {
                throw new HttpResponseException(response()->json([
                    'message' => 'Comments cannot contain haram ingredients or alcohol references.',
                    'terms' => $terms,
                ], 422));
            }
        }

        $comment->body = $body;
        $comment->save();
        $comment->load('user:id,display_name,name,avatar_url');

        return new PostCommentResource($comment);
    }

    /**
     * Delete the author's own comment (author-only) → 204.
     */
    public function destroy(Request $request, Post $post, PostComment $comment): JsonResponse
    {
        $this->assertInPost($post, $comment);
        $this->assertAuthor($request, $comment);

        $comment->delete();

        return response()->json(null, 204);
    }

    /**
     * Report a comment (authed). Idempotent: firstOrCreate on the unique
     * (comment, user) pair, so reporting twice still answers 201 {ok:true}
     * with a single row.
     */
    public function report(Request $request, Post $post, PostComment $comment): JsonResponse
    {
        $this->assertInPost($post, $comment);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        CommentReport::firstOrCreate(
            ['post_comment_id' => $comment->id, 'user_id' => $request->user()->id],
            ['reason' => $validated['reason'] ?? null],
        );

        return response()->json(['ok' => true], 201);
    }

    /**
     * Route binding scopes {comment} by id only — make sure the comment
     * actually belongs to the {post} in the path (else the URL is a lie).
     */
    private function assertInPost(Post $post, PostComment $comment): void
    {
        if ($comment->post_id !== $post->id) {
            abort(404);
        }
    }

    /**
     * Author check: only the creating user may edit/delete a comment.
     * Returns a JSON 403 (the mobile client always expects JSON).
     */
    private function assertAuthor(Request $request, PostComment $comment): void
    {
        if ($comment->user_id !== $request->user()->id) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not own this comment.',
            ], 403));
        }
    }
}
