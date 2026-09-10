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
 * but never acceptable for the author's own write: after the mobile client
 * posts, it redirects straight to the feed, and a cached payload without the
 * new post made it look like posting failed (users waited ~60s / kept
 * refreshing). store/update/destroy forget the author's page-1 buckets (both
 * the unfiltered and the attached-recipe filter) so the redirect shows the
 * write immediately.
 */
class PostFeedCacheTest extends TestCase
{
    use RefreshDatabase;

    /** Creating a post refreshes the author's cached suggested/trending feeds. */
    public function test_creating_a_post_invalidates_the_authors_cached_feeds(): void
    {
        $author = User::factory()->create();
        $recipe = Recipe::create([
            'title'       => 'Cache Test Recipe',
            'source_type' => 'user',
            'owner_id'    => $author->id,
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
                'body'      => 'Fresh out of the pan.',
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
        $post   = Post::create([
            'user_id' => $author->id,
            'body'    => 'Delete me.',
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
        $post   = Post::create([
            'user_id' => $author->id,
            'body'    => 'Original body.',
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
}
