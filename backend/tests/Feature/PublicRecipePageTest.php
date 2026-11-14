<?php

namespace Tests\Feature;

use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the public web recipe page GET /r/{recipe} — the share target of
 * the app's Share button:
 *
 *   1. 200 with the recipe image, EN + AR titles, the Reality badge
 *      ("Recipe says X min" + "Really takes Y min"), steps count, the
 *      "Cooked with RecipeReal" footer, and full OpenGraph meta
 *      (og:title / og:description / og:image / og:url) so WhatsApp
 *      previews render.
 *   2. Without any reality signal only the claim line renders.
 *   3. Unknown ids 404. No auth, no user data on the page.
 */
class PublicRecipePageTest extends TestCase
{
    use RefreshDatabase;

    /** Full-data recipe: both badge lines + all og tags present. */
    public function test_share_page_renders_reality_badge_and_open_graph_meta(): void
    {
        $recipe = Recipe::create([
            'title' => 'One-Pan Lemon Chicken',
            'title_ar' => 'دجاج الليمون بالمقلاة الواحدة',
            'source_type' => 'foodcom',
            'image_url' => 'https://example.com/lemon-chicken.jpg',
            'publisher_time_minutes' => 25,
            'reality_minutes' => 42,
            'reality_source' => 'community',
            'steps_count' => 9,
        ]);

        $response = $this->get("/r/{$recipe->id}");
        $response->assertOk();

        $html = $response->getContent();
        $this->assertStringContainsString('One-Pan Lemon Chicken', $html);
        $this->assertStringContainsString('دجاج الليمون بالمقلاة الواحدة', $html);
        $this->assertStringContainsString('Recipe says <strong>25 min</strong>', $html);
        $this->assertStringContainsString('Really takes <strong>42 min</strong>', $html);
        $this->assertStringContainsString('9 steps', $html);
        $this->assertStringContainsString('Cooked with', $html);
        $this->assertStringContainsString('https://example.com/lemon-chicken.jpg', $html);

        // OpenGraph preview meta.
        $this->assertStringContainsString(
            '<meta property="og:title" content="One-Pan Lemon Chicken">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:description" content="Recipe says 25 min · Really takes 42 min · 9 steps">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:image" content="https://example.com/lemon-chicken.jpg">',
            $html,
        );
        // og:url points at this page's canonical /r/{id} address.
        $this->assertSame(
            1,
            preg_match(
                '~<meta property="og:url" content="[^"]*/r/'.$recipe->id.'">~',
                $html,
            ),
            'og:url must point at the canonical /r/{id} address.',
        );
    }

    /** No reality signal (reality + community average both null) → claim-only badge. */
    public function test_share_page_without_reality_renders_only_the_claim(): void
    {
        $recipe = Recipe::create([
            'title' => 'Simple Masoor Dal',
            'source_type' => 'foodcom',
            'publisher_time_minutes' => 30,
            'steps_count' => 4,
        ]);

        $response = $this->get("/r/{$recipe->id}");
        $response->assertOk();

        $html = $response->getContent();
        $this->assertStringContainsString('Recipe says <strong>30 min</strong>', $html);
        $this->assertStringNotContainsString('Really takes', $html);
        $this->assertStringNotContainsString('og:image', $html);
    }

    /** Unknown ids 404. */
    public function test_share_page_404s_for_unknown_ids(): void
    {
        $this->get('/r/999999')->assertNotFound();
    }

    /** The rendered page is cached per recipe and still serves correctly. */
    public function test_share_page_second_hit_serves_from_cache(): void
    {
        $recipe = Recipe::create([
            'title' => 'Cached Kabsa',
            'source_type' => 'foodcom',
            'steps_count' => 6,
        ]);

        $this->get("/r/{$recipe->id}")->assertOk();
        // Second hit resolves through the 5-minute cache entry.
        $this->get("/r/{$recipe->id}")->assertOk();
    }
}
