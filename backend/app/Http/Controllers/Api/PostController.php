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
     * Create a post (authed). Halal-gated like all community text.
     */
    public function store(StorePostRequest $request): JsonResponse
    {
        $body = $request->string('body')->toString();

        $this->assertHalal($body);

        $post = Post::create([
            'user_id' => $request->user()->id,
            'kind' => $request->string('kind')->toString(),
            'body' => $body,
            'recipe_id' => $request->input('recipe_id'),
            'image_url' => $request->input('image_url'),
        ]);
        $post->load([
            'user:id,display_name,name,avatar_url',
            'recipe:id,title,title_ar,image_url',
        ]);
        $post->likes_count = 0;
        $post->comments_count = 0;
        $post->liked_by_me = false;

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
            'liked' => $liked,
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
                'terms' => $terms,
            ], 422));
        }
    }
}
