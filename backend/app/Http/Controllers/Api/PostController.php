<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Resources\PostResource;
use App\Models\Notification;
use App\Models\Post;
use App\Models\PostReport;
use App\Models\UserBlock;
use App\Support\CommunityFeedCache;
use App\Support\HalalGate;
use App\Support\ShareCache;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Community feed posts: plain posts optionally attached to a recipe,
 * with toggleable likes and comments. Authors can edit/delete their own
 * posts; any signed-in user can report a post, and blocking an author
 * removes their posts from the blocker's feed.
 */
class PostController extends Controller
{
    /**
     * Paginated feed (20/page, newest first), public read.
     * ?recipe_id= filters by attachment. ?sort=trending ranks posts from the
     * LAST 7 DAYS by engagement
     * (likes*2 + comments, then id) instead of recency; when the 7-day
     * window is empty after the filters, it transparently falls back to the
     * same ranking over the whole catalog so the tab never shows an empty
     * trending list early on. liked_by_me is resolved from the sanctum user
     * when a token is given (false for guests). Posts authored by users the
     * sanctum user blocks are excluded. Each row also embeds its newest
     * comment (`latest_comment`, null when none) so clients can render the
     * preview without a per-post comments fetch.
     *
     * Page 1 of sort=suggested and sort=trending is cached for 60 seconds
     * PER USER (guests share one 'guest' bucket): these sorts run heavy
     * correlated-subquery scoring per request, and a ≤60s-stale feed is the
     * designed pull-to-refresh tolerance. The cache holds the FINAL,
     * fully user-resolved response payload (after liked_by_me and the
     * blocked-author filter are applied) so a hit is never stamped with
     * another user's data. Page > 1 and every other sort stay uncached.
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $query = Post::query()
            ->with([
                'user:id,display_name,name,avatar_url',
                'recipe:id,title,title_ar,image_url',
                'latestComment.user:id,display_name,name,avatar_url',
            ])
            ->withCount(['likes', 'comments']);

        if ($request->filled('recipe_id')) {
            $query->where('recipe_id', $request->integer('recipe_id'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        $user = $request->user('sanctum');
        $sort = (string) $request->string('sort');

        // Feed cache gate: page 1 of the expensive sorts only. Keyed per
        // user AND per recipe_id filter so a filtered feed never leaks
        // into the unfiltered one's bucket. Skip cache when user_id is
        // provided so user-filtered profile feeds never collide with global
        // feed cache buckets. The key carries the user's feed
        // version (see CommunityFeedCache): any of their own writes bumps
        // it, so the author's own write is never hidden behind a stale
        // payload while other readers keep the 60s tolerance.
        $cacheKey = null;
        if (
            in_array($sort, CommunityFeedCache::SORTS, true)
            && (int) $request->query('page', 1) <= 1
            && ! $request->filled('user_id')
        ) {
            $recipeId = $request->filled('recipe_id') ? $request->integer('recipe_id') : 0;
            $cacheKey = CommunityFeedCache::cacheKey(
                $sort,
                $recipeId,
                $user?->id ?? 'guest',
            );

            $cached = Cache::get($cacheKey);
            if (is_array($cached)) {
                return response()->json($cached);
            }
        }

        // Moderation: hide posts from authors the current user blocks.
        if ($user !== null) {
            $blockedIds = $this->blockedAuthorIds($user->id);
            if ($blockedIds !== []) {
                $query->whereNotIn('user_id', $blockedIds);
            }
        }

        if ($sort === 'trending') {
            $posts = $this->paginateTrending($query);
        } elseif ($sort === 'suggested' || $sort === 'for_you') {
            $posts = $this->paginateSuggested($query, $user);
        } else {
            $posts = $query->latest('id')->paginate(20);
        }

        // Mark liked_by_me on the page's models (one extra query instead
        // of N+1 through the resource).
        if ($user !== null && $posts->isNotEmpty()) {
            $likedSet = array_flip(
                DB::table('post_likes')
                    ->where('user_id', $user->id)
                    ->whereIn('post_id', $posts->getCollection()->modelKeys())
                    ->pluck('post_id')
                    ->all()
            );

            $posts->getCollection()->each(
                fn (Post $post) => $post->liked_by_me = isset($likedSet[$post->id])
            );
        }

        // Mark user.followed_by_me the same way (drives the feed's
        // Facebook-style Follow/Following pill; false for guests).
        if ($user !== null && $posts->isNotEmpty()) {
            $followedSet = array_flip(
                DB::table('follows')
                    ->where('follower_id', $user->id)
                    ->whereIn('followed_id', $posts->getCollection()->pluck('user_id')->unique()->values()->all())
                    ->pluck('followed_id')
                    ->all()
            );

            $posts->getCollection()->each(function (Post $post) use ($followedSet): void {
                if ($post->user !== null) {
                    $post->user->followed_by_me = isset($followedSet[$post->user_id]);
                }
            });
        }

        $collection = PostResource::collection($posts);

        if ($cacheKey !== null) {
            // Store ONLY the fully user-resolved payload (resource resolved
            // to its final JSON shape here) — never a pre-user stage.
            $payload = $collection->toResponse($request)->getData(true);
            Cache::put($cacheKey, $payload, CommunityFeedCache::PAYLOAD_TTL_SECONDS);

            return response()->json($payload);
        }

        return $collection;
    }

    /**
     * Single-post detail (public). Same shape as the index rows, including
     * like/comment counts, liked_by_me for the optional sanctum user and the
     * embedded `latest_comment` (null when the post has none).
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
            'latestComment.user:id,display_name,name,avatar_url',
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
            'body'      => $body,
            'recipe_id' => $request->input('recipe_id'),
            'image_url' => $firstImageUrl,
            // Eloquent's 'array' cast handles json_encode automatically.
            'images'    => count($images) > 0 ? $images : null,
        ]);

        // The author is about to be redirected to the feed: never let their
        // own 60s-cached page-1 payload hide the post they just created.
        CommunityFeedCache::bump($request->user()->id);

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

        // An edited body must not sit behind the author's cached page-1 feed
        // or the post's cached public share page (/p/{id} + OG tags).
        CommunityFeedCache::bump($request->user()->id);
        ShareCache::forgetPost($post->id);

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

        // A deleted row must not linger in the author's cached page-1 feed.
        CommunityFeedCache::bump($request->user()->id);

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
     *
     * The liker's own cached page-1 feed holds liked_by_me + likes_count, so
     * it is bumped: otherwise liking then refreshing replays the stale
     * payload and the like looks undone. Other readers keep the 60s
     * tolerance on the count/ranking.
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

        CommunityFeedCache::bump($request->user()->id);

        // Inline notification event: a fresh LIKE by someone other than the
        // author notifies the author. Un-liking creates nothing and leaves
        // any earlier notification rows alone (v1 keeps them).
        //
        // Flood guard (M6): like → unlike → like toggling would otherwise
        // re-notify the author on EVERY flip. Skip the insert when an
        // identical notification (same recipient, actor, post, type)
        // already exists from the last 7 days — the like itself still
        // toggles normally.
        if ($liked && $post->user_id !== $request->user()->id) {
            $recentlyNotified = Notification::query()
                ->where('user_id', $post->user_id)
                ->where('actor_id', $request->user()->id)
                ->where('post_id', $post->id)
                ->where('type', 'like')
                ->where('created_at', '>=', now()->subDays(7))
                ->exists();

            if (! $recentlyNotified) {
                Notification::create([
                    'user_id'  => $post->user_id,
                    'type'     => 'like',
                    'actor_id' => $request->user()->id,
                    'post_id'  => $post->id,
                ]);
            }
        }

        return response()->json([
            'liked'       => $liked,
            'likes_count' => $likesCount,
        ]);
    }

    /**
     * Trending pagination for the already-filtered query: posts from the
     * last 7 days ranked by engagement (likes*2 + comments) DESC, id DESC.
     * When the 7-day window is empty after the filters, the same ranking is
     * transparently applied to the whole (filtered) catalog — a cold
     * community must never see an empty trending list.
     *
     * The score is expressed as correlated subqueries rather than the
     * withCount aliases: SQLite (the test driver) cannot reference select
     * aliases inside ORDER BY expressions, so this resolves identically on
     * the test sqlite and the production database.
     */
    private function paginateTrending(Builder $query): LengthAwarePaginator
    {
        $score = '(SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id) * 2'
            . ' + (SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = posts.id)';

        $windowed = (clone $query)
            ->where('posts.created_at', '>=', now()->subDays(7))
            ->orderByRaw("{$score} DESC, posts.id DESC")
            ->paginate(20);

        if ($windowed->isNotEmpty()) {
            return $windowed;
        }

        return (clone $query)
            ->orderByRaw("{$score} DESC, posts.id DESC")
            ->paginate(20);
    }

    private function paginateSuggested(Builder $query, ?\App\Models\User $user): LengthAwarePaginator
    {
        if ($user === null) {
            return $this->paginateTrending($query);
        }

        $userId = $user->id;

        $followedIds = DB::table('follows')->where('follower_id', $userId)->pluck('followed_id')->all();
        $followedList = $followedIds !== [] ? implode(',', array_map('intval', $followedIds)) : '0';

        $likedRecipeIds = DB::table('post_likes')
            ->join('posts as lp', 'lp.id', '=', 'post_likes.post_id')
            ->where('post_likes.user_id', $userId)
            ->whereNotNull('lp.recipe_id')
            ->pluck('lp.recipe_id')->all();

        $cookedRecipeIds = DB::table('cook_sessions')
            ->where('user_id', $userId)
            ->whereNotNull('recipe_id')
            ->pluck('recipe_id')->all();

        // Viewed-recipe ids feed personalization scoring only — cap the
        // pluck so heavy viewers with huge history stay a bounded query.
        $viewedRecipeIds = DB::table('recipe_views')
            ->where('user_id', $userId)
            ->limit(1000)
            ->pluck('recipe_id')
            ->all();

        $affinityRecipeIds = array_values(array_unique(array_merge($likedRecipeIds, $cookedRecipeIds, $viewedRecipeIds)));

        $categories = [];
        if ($affinityRecipeIds !== []) {
            $categories = DB::table('recipes')
                ->whereIn('id', array_slice($affinityRecipeIds, 0, 80))
                ->whereNotNull('category')
                ->pluck('category')->all();
            $categories = array_values(array_unique(array_map(fn ($c) => trim((string) $c), $categories)));
            $categories = array_values(array_filter($categories, fn ($c) => $c !== ''));
        }

        $hasAffinity = $affinityRecipeIds !== [] || $followedIds !== [];

        if (!$hasAffinity) {
            return $this->paginateTrending($query);
        }

        $driver = DB::connection()->getDriverName();
        $isSqlite = $driver === 'sqlite';

        $engagement = '(SELECT COUNT(*) FROM post_likes WHERE post_likes.post_id = posts.id) * 2 + (SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = posts.id)';
        $logEng = $isSqlite ? "ln(1 + ({$engagement}))" : "LOG(1 + ({$engagement}))";
        $hoursAgo = $isSqlite
            ? "(julianday('now') - julianday(posts.created_at)) * 24.0"
            : "TIMESTAMPDIFF(SECOND, posts.created_at, NOW()) / 3600.0";
        $decay = "exp(-({$hoursAgo}) / 48.0)";
        $halfLifeBoost = "1.0 + 0.7 * {$decay}";

        $followScore = $followedIds !== []
            ? "CASE WHEN posts.user_id IN ({$followedList}) THEN 1.8 ELSE 0 END"
            : "0";

        $categoryBoost = "0";
        if ($categories !== []) {
            $quoted = implode(',', array_map(fn ($c) => DB::connection()->getPdo()->quote($c), array_slice($categories, 0, 12)));
            $categoryBoost = "CASE WHEN posts.recipe_id IS NOT NULL AND EXISTS (SELECT 1 FROM recipes r2 WHERE r2.id = posts.recipe_id AND r2.category IN ({$quoted})) THEN 0.9 ELSE 0 END";
        }

        $recipeAffinityBoost = "0";
        if ($affinityRecipeIds !== []) {
            $rList = implode(',', array_map('intval', array_slice($affinityRecipeIds, 0, 60)));
            $recipeAffinityBoost = "CASE WHEN posts.recipe_id IN ({$rList}) THEN 1.2 ELSE 0 END";
        }

        $recentCommentJd = $isSqlite
            ? "(SELECT COALESCE(MAX(julianday(post_comments.created_at)), 0) FROM post_comments WHERE post_comments.post_id = posts.id)"
            : "(SELECT COALESCE(MAX(UNIX_TIMESTAMP(post_comments.created_at)), 0) FROM post_comments WHERE post_comments.post_id = posts.id)";
        $nowJd = $isSqlite ? "julianday('now')" : "UNIX_TIMESTAMP(NOW()) / 86400.0";
        $hasRecentComment = $isSqlite
            ? "CASE WHEN {$recentCommentJd} > {$nowJd} - 2 THEN 0.5 ELSE 0 END"
            : "CASE WHEN {$recentCommentJd} > UNIX_TIMESTAMP(NOW()) - 172800 THEN 0.5 ELSE 0 END";

        $scoreExpr = "(({$logEng}) * ({$halfLifeBoost}) + ({$followScore}) + ({$categoryBoost}) + ({$recipeAffinityBoost}) + ({$hasRecentComment}))";

        $base = clone $query;
        $recent = (clone $base)->where('posts.created_at', '>=', now()->subDays(30))
            ->orderByRaw("{$scoreExpr} DESC, posts.id DESC")
            ->paginate(20);

        if ($recent->isNotEmpty() && $recent->count() >= 6) {
            return $recent;
        }

        return (clone $base)->orderByRaw("{$scoreExpr} DESC, posts.id DESC")->paginate(20);
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
