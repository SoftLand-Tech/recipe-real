<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostLike;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers GET /api/posts?sort=trending:
 *
 *   1. Posts from the last 7 days rank by engagement
 *      (likes*2 + comments) DESC, id DESC — a liked/commented post ranks
 *      above a NEWER unliked one.
 *   2. The ranking applies AFTER the kind/recipe_id filters.
 *   3. When nothing exists in the 7-day window, the feed transparently
 *      falls back to the same ranking over the whole catalog (a cold
 *      community never sees an empty trending list).
 */
class PostTrendingSortTest extends TestCase
{
    use RefreshDatabase;

    /** A liked + commented post ranks above a newer unliked one. */
    public function test_trending_ranks_liked_post_above_newer_unliked_one(): void
    {
        $author   = User::factory()->create();
        $liker    = User::factory()->create();
        $likerTwo = User::factory()->create();
        $commenter = User::factory()->create();

        // Older post, 2 likes + 1 comment → score 5.
        $liked = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Slower than the recipe said, but great.',
        ]);
        // Keep it inside the 7-day window but clearly older.
        DB::table('posts')
            ->where('id', $liked->id)
            ->update(['created_at' => now()->subDays(2)]);

        PostLike::create(['post_id' => $liked->id, 'user_id' => $liker->id]);
        PostLike::create(['post_id' => $liked->id, 'user_id' => $likerTwo->id]);
        PostComment::create([
            'post_id' => $liked->id,
            'user_id' => $commenter->id,
            'body'    => 'same here',
        ]);

        // Newer post, zero engagement → score 0.
        $unliked = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Just posted this second.',
        ]);

        $response = $this->getJson('/api/posts?sort=trending');
        $response->assertOk();

        $rows = $response->json('data');
        $this->assertCount(2, $rows);
        $this->assertSame($liked->id, $rows[0]['id'], 'Engagement must outrank recency.');
        $this->assertSame($unliked->id, $rows[1]['id']);
    }

    /** Trending applies after the kind filter (only matching kinds ranked). */
    public function test_trending_applies_after_the_kind_filter(): void
    {
        $author = User::factory()->create();
        $liker  = User::factory()->create();

        $likedFail = Post::create([
            'user_id' => $author->id,
            'kind'    => 'fail',
            'body'    => 'Burned it.',
        ]);
        PostLike::create(['post_id' => $likedFail->id, 'user_id' => $liker->id]);

        $plainTry = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Plain try inside the window.',
        ]);

        $response = $this->getJson('/api/posts?kind=try&sort=trending');
        $response->assertOk();

        $rows = $response->json('data');
        $this->assertCount(1, $rows, 'The kind filter must run before the ranking.');
        $this->assertSame($plainTry->id, $rows[0]['id']);
    }

    /** Nothing in the last 7 days → whole-catalog ranking, still ordered by score. */
    public function test_trending_falls_back_when_nothing_is_within_7_days(): void
    {
        $author    = User::factory()->create();
        $liker     = User::factory()->create();
        $commenter = User::factory()->create();

        // Both posts are 10 days old — the 7-day window is empty.
        $likedOld = Post::create([
            'user_id' => $author->id,
            'kind'    => 'question',
            'body'    => 'Old question with engagement.',
        ]);
        $unlikedOld = Post::create([
            'user_id' => $author->id,
            'kind'    => 'question',
            'body'    => 'Older question, no engagement.',
        ]);
        DB::table('posts')->whereIn('id', [$likedOld->id, $unlikedOld->id])
            ->update(['created_at' => now()->subDays(10)]);

        PostLike::create(['post_id' => $likedOld->id, 'user_id' => $liker->id]);
        PostComment::create([
            'post_id' => $likedOld->id,
            'user_id' => $commenter->id,
            'body'    => 'still relevant',
        ]);

        $response = $this->getJson('/api/posts?sort=trending');
        $response->assertOk();

        $rows = $response->json('data');
        $this->assertCount(2, $rows, 'Fallback must surface the whole catalog, not an empty list.');
        $this->assertSame($likedOld->id, $rows[0]['id'], 'Fallback keeps the engagement ranking.');
        $this->assertSame($unlikedOld->id, $rows[1]['id']);
    }
}
