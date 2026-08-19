<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Notification;
use App\Models\Post;
use App\Models\PostReport;
use App\Models\UserBlock;
use App\Support\HalalGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Community feed posts: "I tried it" / "I failed it" / "I have a question",
 * optionally attached to a recipe, with toggleable likes and comments.
 * Authors can edit/delete their own posts; any signed-in user can report a
 * post, and blocking an author removes their posts from the blocker's feed.
 */
class PostController extends Controller
{
    /**
     * Paginated feed (20/page, newest first), public read.
     * ?kind=try|fail|question filters by kind, ?recipe_id= by attachment.
     * liked_by_me is resolved from the sanctum user when a token is given
     * (false for guests). Posts authored by users the sanctum user blocks
     * are excluded.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Post::query()
            ->with([
                'user:id,display_name,name,avatar_url',
                'recipe:id,title,title_ar,image_url',
            ])
            ->withCount(['likes', 'comments']);

        if ($request->filled('kind')) {
            $kind = (string) $request->string('kind');
            if (in_array($kind, Post::KINDS, true)) {
                $query->where('kind', $kind);
            }
        }

        if ($request->filled('recipe_id')) {
            $query->where('recipe_id', $request->integer('recipe_id'));
        }

        // Moderation: hide posts from authors the current user blocks.
        $user = $request->user('sanctum');
        if ($user !== null) {
            $blockedIds = $this->blockedAuthorIds($user->id);
            if ($blockedIds !== []) {
                $query->whereNotIn('user_id', $blockedIds);
            }
        }

        $posts = $query->latest('id')->paginate(20);

        // Mark liked_by_me on the page's models (one extra query instead
        // of N+1 through the resource).
        if ($user !== null && $posts->isNotEmpty()) {
            $likedIds = DB::table('post_likes')
                ->where('user_id', $user->id)
                ->whereIn('post_id', $posts->getCollection()->modelKeys())
                ->pluck('post_id')
                ->all();

            $posts->getCollection()->each(
                fn (Post $post) => $post->liked_by_me = in_array($post->id, $likedIds)
            );
        }

        return PostResource::collection($posts);
    }

    /**
     * Single-post detail (public). Same shape as the index rows, including
     * like/comment counts and liked_by_me for the optional sanctum user.
     * Registered at GET /posts/{post} (see api.php). A post authored by a
     * user the sanctum user blocks 404s for the blocker.
     */
    public function show(Request $request, Post $post): PostResource
    {
        $user = $request->user('sanctum');

        // Moderation: a blocked author's post does not exist for the blocker.
        if (
            $user !== null
            && in_array($post->user_id, $this->blockedAuthorIds($user->id), true)
        ) {
            abort(404);
        }

        $post->load([
            'user:id,display_name,name,avatar_url',
            'recipe:id,title,title_ar,image_url',
        ]);
        $post->loadCount(['likes', 'comments']);

        if ($user !== null) {
            $post->liked_by_me = DB::table('post_likes')
                ->where('post_id', $post->id)
                ->where('user_id', $user->id)
                ->exists();
        } else {
            $post->liked_by_me = false;
        }

        return new PostResource($post);
    }

    /**
     * Create a post (authed). Halal-gated like all community text.
     *
     * Multi-image: if `images` is provided (array of uploaded URLs, max 6),
     * it is stored as JSON in the `images` column and `image_url` is set to
     * the first entry for backward compatibility with old clients. If only
     * the legacy `image_url` is provided, it is stored as-is with no `images`
     * column data.
     */
    public function store(StorePostRequest $request): JsonResponse
    {
        $body = $request->string('body')->toString();

        $this->assertHalal($body);

        // Resolve the effective image list from the request.
        $imagesInput = $request->input('images');
        $images      = is_array($imagesInput) && count($imagesInput) > 0
            ? array_values(array_filter($imagesInput, fn ($v) => is_string($v) && $v !== ''))
            : [];

        // Legacy image_url: only used when no images array was sent.
        $legacyImageUrl = $request->input('image_url');

        // `image_url` is always the first image (backward compat).
        $firstImageUrl = count($images) > 0 ? $images[0] : $legacyImageUrl;

        $post = Post::create([
            'user_id'   => $request->user()->id,
            'kind'      => $request->string('kind')->toString(),
            'body'      => $body,
            'recipe_id' => $request->input('recipe_id'),
            'image_url' => $firstImageUrl,
            // Eloquent's 'array' cast handles json_encode automatically.
            'images'    => count($images) > 0 ? $images : null,
        ]);
        $post->load([
            'user:id,display_name,name,avatar_url',
            'recipe:id,title,title_ar,image_url',
        ]);
        $post->likes_count    = 0;
        $post->comments_count = 0;
        $post->liked_by_me    = false;

        return (new PostResource($post))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update the post's body (author-only). Validates like store and re-runs
     * the halal gate whenever the text changes. Responds with the same
     * PostResource shape as show() (updated_at > created_at → edited: true).
     */
    public function update(Request $request, Post $post): PostResource
    {
        $this->assertAuthor($request, $post);

        $validated = $request->validate([
            'body' => ['required', 'string', 'min:1', 'max:2000'],
        ]);

        $body = (string) $validated['body'];

        if ($body !== $post->body) {
            $this->assertHalal($body);
        }

        $post->body = $body;
        $post->save();

        // Same shape as show(): relations, counts and liked_by_me.
        $post->load([
            'user:id,display_name,name,avatar_url',
            'recipe:id,title,title_ar,image_url',
        ]);
        $post->loadCount(['likes', 'comments']);
        $post->liked_by_me = DB::table('post_likes')
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->exists();

        return new PostResource($post);
    }

    /**
     * Delete the author's own post (author-only) → 204. Likes, comments and
     * reports disappear via their cascade FKs (000026 + 000029).
     */
    public function destroy(Request $request, Post $post): JsonResponse
    {
        $this->assertAuthor($request, $post);

        $post->delete();

        return response()->json(null, 204);
    }

    /**
     * Report a post (authed). Idempotent: firstOrCreate on the unique
     * (post, user) pair, so reporting twice still answers 201 {ok:true}
     * with a single row. `reason` is optional free text for moderators.
     */
    public function report(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        PostReport::firstOrCreate(
            ['post_id' => $post->id, 'user_id' => $request->user()->id],
            ['reason' => $validated['reason'] ?? null],
        );

        return response()->json(['ok' => true], 201);
    }

    /**
     * Toggle the authed user's like on a post → {liked, likes_count}.
     */
    public function like(Request $request, Post $post): JsonResponse
    {
        $existing = DB::table('post_likes')
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->exists();

        if ($existing) {
            DB::table('post_likes')
                ->where('post_id', $post->id)
                ->where('user_id', $request->user()->id)
                ->delete();

            $liked = false;
        } else {
            DB::table('post_likes')->insert([
                'post_id' => $post->id,
                'user_id' => $request->user()->id,
            ]);

            $liked = true;
        }

        $likesCount = (int) DB::table('post_likes')
            ->where('post_id', $post->id)
            ->count();

        // Inline notification event: a fresh LIKE by someone other than the
        // author notifies the author. Un-liking creates nothing and leaves
        // any earlier notification rows alone (v1 keeps them).
        if ($liked && $post->user_id !== $request->user()->id) {
            Notification::create([
                'user_id'  => $post->user_id,
                'type'     => 'like',
                'actor_id' => $request->user()->id,
                'post_id'  => $post->id,
            ]);
        }

        return response()->json([
            'liked'       => $liked,
            'likes_count' => $likesCount,
        ]);
    }

    /**
     * Halal gate: 422 with the offending terms (see HalalGate).
     */
    private function assertHalal(string $body): void
    {
        $terms = HalalGate::scan([$body]);

        if ($terms !== []) {
            throw new HttpResponseException(response()->json([
                'message' => 'Posts cannot contain haram ingredients or alcohol references.',
                'terms'   => $terms,
            ], 422));
        }
    }

    /**
     * Author check: only the creating user may edit/delete a post. Returns
     * a JSON 403 (the mobile client always expects JSON).
     */
    private function assertAuthor(Request $request, Post $post): void
    {
        if ($post->user_id !== $request->user()->id) {
            throw new HttpResponseException(response()->json([
                'message' => 'You do not own this post.',
            ], 403));
        }
    }

    /**
     * Ids of authors the given user blocks (one query; callers apply
     * whereNotIn / in_array on it).
     *
     * @return list<int>
     */
    private function blockedAuthorIds(int $userId): array
    {
        return UserBlock::query()
            ->where('blocker_id', $userId)
            ->pluck('blocked_id')
            ->all();
    }
}
