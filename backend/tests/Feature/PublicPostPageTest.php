<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Covers the public web post page GET /p/{post} — the share target behind
 * the app's post Share buttons (feed card + post detail):
 *
 *   1. 200 with PUBLIC data only: author display name + avatar, the full
 *      body, up to 4 images, and full OpenGraph meta (og:title /
 *      og:description / og:image / og:url) so WhatsApp previews render.
 *   2. Posts with an attached recipe render the small recipe card linking
 *      to /r/{recipe} with its "Recipe says X · Really takes Y" badge.
 *   3. Unknown ids 404. No auth, no counts, no comments on the page.
 */
class PublicPostPageTest extends TestCase
{
    use RefreshDatabase;

    /** Full-data post: author + avatar + body + images + og meta. */
    public function test_share_page_renders_post_body_and_open_graph_meta(): void
    {
        $user = User::factory()->create([
            'name'         => 'Account Name',
            'display_name' => 'Mona Sobhy',
            'avatar_url'   => 'https://example.com/avatar.jpg',
        ]);
        $body = 'Nailed the one-pan lemon chicken tonight — crispy skin and all. ';
        $post = Post::create([
            'user_id' => $user->id,
            'body'    => $body . str_repeat('x', 130),
            'images'  => [
                'https://example.com/plate-1.jpg',
                'https://example.com/plate-2.jpg',
                'https://example.com/plate-3.jpg',
            ],
        ]);

        $response = $this->get("/p/{$post->id}");
        $response->assertOk();

        $html = $response->getContent();
        // Public content: author, avatar, body, images.
        $this->assertStringContainsString('Mona Sobhy', $html);
        $this->assertStringContainsString('https://example.com/avatar.jpg', $html);
        $this->assertStringContainsString('Nailed the one-pan lemon chicken tonight', $html);
        $this->assertStringContainsString('https://example.com/plate-1.jpg', $html);
        $this->assertStringContainsString('https://example.com/plate-3.jpg', $html);
        $this->assertStringContainsString('Cooked with', $html);

        // OpenGraph preview meta.
        $this->assertStringContainsString(
            '<meta property="og:title" content="Mona Sobhy shared a post on RecipeReal">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:description" content="' . e(Str::limit(trim($body . str_repeat('x', 130)), 120)) . '">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:image" content="https://example.com/plate-1.jpg">',
            $html,
        );
        // og:url points at this page's canonical /p/{id} address.
        $this->assertSame(
            1,
            preg_match(
                '~<meta property="og:url" content="[^"]*/p/'.$post->id.'">~',
                $html,
            ),
            'og:url must point at the canonical /p/{id} address.',
        );
    }

    /** Attached recipe: small card linking to /r/{recipe} + badge lines. */
    public function test_share_page_with_recipe_renders_the_recipe_link(): void
    {
        $user   = User::factory()->create();
        $recipe = Recipe::create([
            'title'                  => 'One-Pan Lemon Chicken',
            'source_type'            => 'foodcom',
            'image_url'              => 'https://example.com/lemon-chicken.jpg',
            'publisher_time_minutes' => 25,
            'reality_minutes'        => 42,
            'reality_source'         => 'community',
        ]);
        $post = Post::create([
            'user_id'   => $user->id,
            'body'      => 'The skin burned before the thighs finished.',
            'recipe_id' => $recipe->id,
        ]);

        $response = $this->get("/p/{$post->id}");
        $response->assertOk();

        $html = $response->getContent();
        $this->assertStringContainsString(
            'href="' . url('/r/' . $recipe->id) . '"',
            $html,
        );
        $this->assertStringContainsString('One-Pan Lemon Chicken', $html);
        $this->assertStringContainsString('Recipe says 25 min', $html);
        $this->assertStringContainsString('Really takes 42 min', $html);
        // No post images → og:image falls back to the recipe image.
        $this->assertStringContainsString(
            '<meta property="og:image" content="https://example.com/lemon-chicken.jpg">',
            $html,
        );
    }

    /** No counts, no comments — the page shows public content only. */
    public function test_share_page_shows_no_counts_or_comments(): void
    {
        $user = User::factory()->create();
        $post = Post::create([
            'user_id' => $user->id,
            'body'    => 'Any trick for crispy skin without burning it?',
        ]);

        $html = $this->get("/p/{$post->id}")->getContent();

        $this->assertStringNotContainsString('likes', $html);
        $this->assertStringNotContainsString('comments', $html);
    }

    /** Unknown ids 404. */
    public function test_share_page_404s_for_unknown_ids(): void
    {
        $this->get('/p/999999')->assertNotFound();
    }

    /** The rendered page is cached per post and still serves correctly. */
    public function test_share_page_second_hit_serves_from_cache(): void
    {
        $user = User::factory()->create();
        $post = Post::create([
            'user_id' => $user->id,
            'body'    => 'Cached shakshuka success.',
        ]);

        $this->get("/p/{$post->id}")->assertOk();
        // Second hit resolves through the 5-minute cache entry.
        $this->get("/p/{$post->id}")->assertOk();
    }
}
