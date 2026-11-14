<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the multi-image upgrade to the community post store + show endpoints.
 *
 * Scenarios:
 *   1. A post submitted with `images` (3 URLs) round-trips through store → show:
 *      - `images` matches all 3 URLs
 *      - `image_url` is set to the first image (backward-compat)
 *   2. A legacy post whose only `image_url` column is set (no `images` column)
 *      returns `images: [image_url]` from the backfill logic in PostResource.
 *   3. GET /api/posts/{post} returns 200 with the same shape as the feed.
 */
class PostMultiImageTest extends TestCase
{
    use RefreshDatabase;

    /** Store + show round-trip for a 3-image post. */
    public function test_store_with_images_array_round_trips_through_show(): void
    {
        // The image-host allowlist must accept this test's CDN host.
        config(['recipereal.uploads.allowed_image_hosts' => ['cdn.example.com']]);

        $user = User::factory()->create();
        $images = [
            'https://cdn.example.com/a.jpg',
            'https://cdn.example.com/b.jpg',
            'https://cdn.example.com/c.jpg',
        ];

        $createResponse = $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'body' => 'Made shakshuka — absolutely nailed it!',
                'images' => $images,
            ]);

        $createResponse->assertStatus(201);
        $data = $createResponse->json('data');

        // `images` must reflect all 3 URLs.
        $this->assertSame($images, $data['images']);
        // `image_url` backward-compat: must be the first image.
        $this->assertSame($images[0], $data['image_url']);

        $postId = $data['id'];

        // Show endpoint returns identical shape.
        $showResponse = $this->getJson("/api/posts/{$postId}");
        $showResponse->assertOk();
        $showData = $showResponse->json('data');

        $this->assertSame($images, $showData['images']);
        $this->assertSame($images[0], $showData['image_url']);

        // Verify DB persistence.
        $this->assertDatabaseHas('posts', [
            'id' => $postId,
            'image_url' => $images[0],
        ]);
        $row = Post::find($postId);
        $this->assertSame($images, $row->images);
    }

    /** Legacy single-image_url post returns [image_url] in the `images` field. */
    public function test_legacy_single_image_url_post_backfills_images_array(): void
    {
        $user = User::factory()->create();
        $imageUrl = 'https://cdn.example.com/legacy.jpg';

        // Directly insert a legacy post (no `images` column value).
        $post = Post::create([
            'user_id' => $user->id,
            'body' => 'Burnt the rice again.',
            'image_url' => $imageUrl,
        ]);

        $response = $this->getJson("/api/posts/{$post->id}");
        $response->assertOk();

        $data = $response->json('data');
        // Backfill: single-element array wrapping the legacy image_url.
        $this->assertSame([$imageUrl], $data['images']);
        $this->assertSame($imageUrl, $data['image_url']);
    }

    /** GET /api/posts/{post} returns 200 with standard post shape. */
    public function test_show_returns_post_with_expected_shape(): void
    {
        $user = User::factory()->create();
        $post = Post::create([
            'user_id' => $user->id,
            'body' => 'How long should I marinate chicken?',
        ]);

        $response = $this->getJson("/api/posts/{$post->id}");
        $response->assertOk();
        $response->assertJsonStructure([
            'data' => [
                'id',
                'body',
                'image_url',
                'images',
                'user',
                'likes_count',
                'comments_count',
                'liked_by_me',
                'created_at',
            ],
        ]);

        $data = $response->json('data');
        $this->assertSame([], $data['images']);
        $this->assertNull($data['image_url']);
        $this->assertSame(0, $data['likes_count']);
        $this->assertSame(0, $data['comments_count']);
        $this->assertFalse($data['liked_by_me']);
    }
}
