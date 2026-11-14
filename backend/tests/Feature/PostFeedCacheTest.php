<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Page 1 of sort=suggested and sort=trending is cached for 60 seconds PER
 * USER (see PostController::index) — a tolerated staleness for other readers,
 * but never acceptable for the reader's own writes: after the mobile client
 * posts, it redirects straight to the feed, and a cached payload without the
 * new post made it look like posting failed (users waited ~60s / kept
 * refreshing). The same staleness hid likes (liked_by_me flipped back to
 * false on refresh), comments (old counts/previews) and follows/blocks.
 *
 * Every community write bumps the actor's feed version
 * (CommunityFeedCache::bump), which is part of the cache key — so one bump
 * invalidates all of their buckets at once (both sorts, every recipe_id
 * filter). Covered here: post store/update/destroy, like/unlike, comment
 * store, follow/unfollow, block/unblock.
 */
class PostFeedCacheTest extends TestCase
{
    use RefreshDatabase;

    /** Creating a post refreshes the author's cached suggested/trending feeds. */
    public function test_creating_a_post_invalidates_the_authors_cached_feeds(): void
    {
        $author = User::factory()->create();
        $recipe = Recipe::create([
            'title' => 'Cache Test Recipe',
            'source_type' => 'user',
            'owner_id' => $author->id,
        ]);

        // Prime every page-1 bucket the author could come back to: both sorts,
        // unfiltered and recipe-filtered — all empty for now.
        foreach (['suggested', 'trending'] as $sort) {
            $this->actingAs($author, 'sanctum')
                ->getJson("/api/posts?sort={$sort}")
                ->assertOk()
                ->assertJsonCount(0, 'data');
            $this->actingAs($author, 'sanctum')
                ->getJson("/api/posts?recipe_id={$recipe->id}&sort={$sort}")
                ->assertOk()
                ->assertJsonCount(0, 'data');
        }

        // Publish through the API (the exact flow the composer uses).
        $created = $this->actingAs($author, 'sanctum')
            ->postJson('/api/posts', [
                'body' => 'Fresh out of the pan.',
                'recipe_id' => $recipe->id,
            ]);
        $created->assertStatus(201);
        $postId = $created->json('data.id');

        // Every primed bucket must now return the new post, not the stale
        // empty payload.
        foreach (['suggested', 'trending'] as $sort) {
            $feed = $this->actingAs($author, 'sanctum')
                ->getJson("/api/posts?sort={$sort}");
            $feed->assertOk();
            $this->assertSame(
                $postId,
                $feed->json('data.0.id'),
                "sort={$sort} must show the author's just-created post first.",
            );

            $filtered = $this->actingAs($author, 'sanctum')
                ->getJson("/api/posts?recipe_id={$recipe->id}&sort={$sort}");
            $filtered->assertOk();
            $this->assertSame(
                $postId,
                $filtered->json('data.0.id'),
                "sort={$sort} recipe filter must show the just-created post.",
            );
        }
    }

    /** Deleting a post removes it from the author's cached feed immediately. */
    public function test_deleting_a_post_invalidates_the_authors_cached_feed(): void
    {
        $author = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Delete me.',
        ]);

        // Prime the cache while the post still exists.
        $this->actingAs($author, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/posts/{$post->id}")
            ->assertStatus(204);

        $this->actingAs($author, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    }

    /** Editing a post's body refreshes the author's cached feed. */
    public function test_updating_a_post_invalidates_the_authors_cached_feed(): void
    {
        $author = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Original body.',
        ]);

        // Prime the cache with the original body.
        $this->actingAs($author, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Original body.');

        $this->actingAs($author, 'sanctum')
            ->patchJson("/api/posts/{$post->id}", ['body' => 'Edited body.'])
            ->assertOk();

        $this->actingAs($author, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.body', 'Edited body.');
    }

    /** Liking shows liked_by_me + the new count on the liker's next refresh. */
    public function test_liking_a_post_invalidates_the_likers_cached_feed(): void
    {
        $author = User::factory()->create();
        $liker = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Like this post.',
        ]);

        // Prime the liker's cache: not liked yet.
        $this->actingAs($liker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.liked_by_me', false)
            ->assertJsonPath('data.0.likes_count', 0);

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('liked', true);

        // Without the bump this replays the primed payload (liked_by_me
        // false) — the "my like disappeared on refresh" bug.
        $this->actingAs($liker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.id', $post->id)
            ->assertJsonPath('data.0.liked_by_me', true)
            ->assertJsonPath('data.0.likes_count', 1);
    }

    /** Unliking clears liked_by_me on the liker's next refresh. */
    public function test_unliking_a_post_invalidates_the_likers_cached_feed(): void
    {
        $author = User::factory()->create();
        $liker = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Unlike this post.',
        ]);

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertOk();

        // Prime the cache while liked.
        $this->actingAs($liker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.liked_by_me', true);

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('liked', false);

        $this->actingAs($liker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.liked_by_me', false)
            ->assertJsonPath('data.0.likes_count', 0);
    }

    /** Commenting refreshes the commenter's count + latest-comment preview. */
    public function test_commenting_invalidates_the_commenters_cached_feed(): void
    {
        $author = User::factory()->create();
        $commenter = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Comment on this post.',
        ]);

        // Prime the commenter's cache: no comments yet.
        $this->actingAs($commenter, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.comments_count', 0);

        $this->actingAs($commenter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Tried it, loved it.'])
            ->assertStatus(201);

        $this->actingAs($commenter, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.comments_count', 1)
            ->assertJsonPath('data.0.latest_comment.body', 'Tried it, loved it.');
    }

    /** Following flips followed_by_me on the follower's next refresh. */
    public function test_following_invalidates_the_followers_cached_feed(): void
    {
        $author = User::factory()->create();
        $follower = User::factory()->create();
        Post::create([
            'user_id' => $author->id,
            'body' => 'Follow this author.',
        ]);

        // Prime the follower's cache: not following yet.
        $this->actingAs($follower, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.user.followed_by_me', false);

        $this->actingAs($follower, 'sanctum')
            ->postJson("/api/users/{$author->id}/follow")
            ->assertStatus(201);

        $this->actingAs($follower, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonPath('data.0.user.followed_by_me', true);
    }

    /** Blocking hides (and unblocking restores) the author on next refresh. */
    public function test_blocking_invalidates_the_blockers_cached_feed(): void
    {
        $author = User::factory()->create();
        $blocker = User::factory()->create();
        Post::create([
            'user_id' => $author->id,
            'body' => 'Block this author.',
        ]);

        // Prime the blocker's cache while the post is visible.
        $this->actingAs($blocker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($blocker, 'sanctum')
            ->postJson("/api/users/{$author->id}/block")
            ->assertStatus(201);

        $this->actingAs($blocker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        $this->actingAs($blocker, 'sanctum')
            ->deleteJson("/api/users/{$author->id}/block")
            ->assertStatus(204);

        $this->actingAs($blocker, 'sanctum')
            ->getJson('/api/posts?sort=suggested')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
