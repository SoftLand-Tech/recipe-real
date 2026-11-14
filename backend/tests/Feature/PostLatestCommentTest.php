<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the `latest_comment` embed on PostResource (the feed's
 * latest-comment preview, which replaced the per-card GET /posts/{id}/comments
 * N+1 on the mobile client):
 *
 *   1. Feed rows carry latest_comment matching the NEWEST comment (id desc)
 *      including its author block {id, display_name, name, avatar_url}.
 *   2. Posts without comments have latest_comment === null (not omitted).
 *   3. GET /api/posts/{post} embeds the same block on the detail shape.
 *   4. The recipe_id filter only returns posts attached to that recipe.
 */
class PostLatestCommentTest extends TestCase
{
    use RefreshDatabase;

    /** Feed rows embed the newest comment with its author. */
    public function test_feed_rows_embed_the_newest_comment(): void
    {
        $author = User::factory()->create();
        $commenterA = User::factory()->create();
        // Explicit display_name: UserPublicResource falls back to the
        // account name when null, so only an explicit value round-trips.
        $commenterB = User::factory()->create([
            'display_name' => 'Umm Sulaym',
        ]);

        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Made the lemon chicken — worth it.',
        ]);

        $older = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $commenterA->id,
            'body' => 'first comment',
        ]);
        $newest = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $commenterB->id,
            'body' => 'second (newest) comment',
        ]);

        $response = $this->getJson('/api/posts');
        $response->assertOk();

        $row = collect($response->json('data'))
            ->firstWhere('id', $post->id);

        $this->assertNotNull($row, 'Feed must contain the seeded post.');
        $this->assertIsArray($row['latest_comment']);
        $this->assertSame($newest->id, $row['latest_comment']['id']);
        $this->assertSame('second (newest) comment', $row['latest_comment']['body']);
        $this->assertNotEquals($older->id, $row['latest_comment']['id']);
        $this->assertNotEmpty($row['latest_comment']['created_at']);
        $this->assertSame($commenterB->id, $row['latest_comment']['user']['id']);
        // Public payloads expose display_name only (never the account name).
        $this->assertSame(
            [$commenterB->display_name, $commenterB->avatar_url],
            [
                $row['latest_comment']['user']['display_name'],
                $row['latest_comment']['user']['avatar_url'],
            ],
        );
        $this->assertArrayNotHasKey('name', $row['latest_comment']['user']);
    }

    /** Posts without comments carry latest_comment === null. */
    public function test_feed_rows_without_comments_have_null_latest_comment(): void
    {
        $author = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Any substitute for sumac?',
        ]);

        $response = $this->getJson('/api/posts');
        $response->assertOk();

        $row = collect($response->json('data'))
            ->firstWhere('id', $post->id);

        $this->assertNotNull($row);
        $this->assertArrayHasKey('latest_comment', $row);
        $this->assertNull($row['latest_comment']);
    }

    /** The single-post detail endpoint embeds the same latest_comment block. */
    public function test_show_embeds_latest_comment(): void
    {
        $author = User::factory()->create();
        $commenter = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Souq batch was too salty.',
        ]);
        $newest = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $commenter->id,
            'body' => 'rinse the leeks next time',
        ]);

        $response = $this->getJson("/api/posts/{$post->id}");
        $response->assertOk();

        $data = $response->json('data');
        $this->assertSame($newest->id, $data['latest_comment']['id']);
        $this->assertSame('rinse the leeks next time', $data['latest_comment']['body']);
        $this->assertSame($commenter->id, $data['latest_comment']['user']['id']);
    }

    /** The recipe_id filter narrows the feed to that recipe's posts. */
    public function test_recipe_id_filter_returns_only_that_recipes_posts(): void
    {
        $author = User::factory()->create();
        $recipeA = Recipe::create([
            'title' => 'Recipe A',
            'source_type' => 'foodcom',
        ]);
        $recipeB = Recipe::create([
            'title' => 'Recipe B',
            'source_type' => 'foodcom',
        ]);

        $postA = Post::create([
            'user_id' => $author->id,
            'body' => 'Tried recipe A.',
            'recipe_id' => $recipeA->id,
        ]);
        Post::create([
            'user_id' => $author->id,
            'body' => 'Tried recipe B.',
            'recipe_id' => $recipeB->id,
        ]);

        $response = $this->getJson("/api/posts?recipe_id={$recipeA->id}");
        $response->assertOk();

        $rows = $response->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($postA->id, $rows[0]['id']);
        $this->assertSame($recipeA->id, $rows[0]['recipe']['id']);
    }
}
