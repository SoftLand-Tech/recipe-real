<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Support\HalalGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Community feed posts: "I tried it" / "I failed it" / "I have a question",
 * optionally attached to a recipe, with toggleable likes and comments.
 */
class PostController extends Controller
{
    /**
     * Paginated feed (20/page, newest first), public read.
     * ?kind=try|fail|question filters by kind, ?recipe_id= by attachment.
     * liked_by_me is resolved from the sanctum user when a token is given
     * (false for guests).
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

        $posts = $query->latest('id')->paginate(20);

        // Mark liked_by_me on the page's models (one extra query instead
        // of N+1 through the resource).
        $user = $request->user('sanctum');
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
     * Registered at GET /posts/{post} (see api.php).
     */
    public function show(Request $request, Post $post): PostResource
    {
        $post->load([
            'user:id,display_name,name,avatar_url',
            'recipe:id,title,title_ar,image_url',
        ]);
        $post->loadCount(['likes', 'comments']);

        $user = $request->user('sanctum');
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
}
