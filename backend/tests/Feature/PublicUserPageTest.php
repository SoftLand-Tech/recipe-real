<?php

namespace Tests\Feature;

use App\Models\Follow;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the public web profile page GET /u/{user} — the share target of
 * the app's profile Share button (the https link App Links hand to the
 * app when installed; everyone else lands here with a download banner):
 *
 *   1. 200 with the display name, avatar, bio, follower/following/recipe
 *      counts, recipe cards linking to /r/{id}, and full OpenGraph meta
 *      so WhatsApp previews render.
 *   2. The card Reality badge uses the same claim/reality precedence as
 *      /r (persisted reality first, community average as fallback).
 *   3. PUBLIC data only — the internal users.name, email and gender never
 *      render (ProfileController::payload publicOnly is the allowlist).
 *   4. Cooks without a display name get the neutral bilingual fallback.
 *   5. Unknown ids 404; profiles with no recipes render without the grid.
 */
class PublicUserPageTest extends TestCase
{
    use RefreshDatabase;

    private function cook(array $attributes = []): User
    {
        return User::factory()->create($attributes + [
            'display_name' => 'Chef Amal',
            'avatar_url' => 'https://example.com/amal.jpg',
            'bio' => 'I cook fast, honestly.',
        ]);
    }

    private function ownedRecipe(User $cook, array $attributes = []): Recipe
    {
        return Recipe::create($attributes + [
            'owner_id' => $cook->id,
            'title' => 'Quick Koshari',
            'title_ar' => 'كشري سريع',
            'source_type' => 'user',
            'image_url' => 'https://example.com/koshari.jpg',
            'publisher_time_minutes' => 45,
            'steps_count' => 7,
        ]);
    }

    /** Full-data profile: identity, counts, cards and all og tags present. */
    public function test_profile_page_renders_identity_counts_cards_and_open_graph_meta(): void
    {
        $cook = $this->cook();
        $recipe = $this->ownedRecipe($cook, [
            'reality_minutes' => 80,
            'reality_source' => 'community',
        ]);
        Follow::create(['follower_id' => User::factory()->create()->id, 'followed_id' => $cook->id]);

        $response = $this->get("/u/{$cook->id}");
        $response->assertOk();

        $html = $response->getContent();
        $this->assertStringContainsString('Chef Amal', $html);
        $this->assertStringContainsString('I cook fast, honestly.', $html);
        $this->assertStringContainsString('https://example.com/amal.jpg', $html);
        $this->assertStringContainsString('Recipes by Chef Amal', $html);
        // 1 recipe + 1 follower on the stat chips.
        $this->assertStringContainsString('<strong>1</strong> Recipes', $html);
        $this->assertStringContainsString('<strong>1</strong> Followers', $html);
        // The card links back into the /r share page with both badge lines.
        $this->assertStringContainsString('href="'.url('/r/'.$recipe->id).'"', $html);
        $this->assertStringContainsString('Quick Koshari', $html);
        $this->assertStringContainsString('Recipe says 45 min', $html);
        $this->assertStringContainsString('Really takes 80 min', $html);

        // OpenGraph preview meta.
        $this->assertStringContainsString(
            '<meta property="og:title" content="Chef Amal — RecipeReal">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:description" content="I cook fast, honestly.">',
            $html,
        );
        $this->assertStringContainsString(
            '<meta property="og:image" content="https://example.com/amal.jpg">',
            $html,
        );
        // og:url points at this page's canonical /u/{id} address.
        $this->assertSame(
            1,
            preg_match(
                '~<meta property="og:url" content="[^"]*/u/'.$cook->id.'">~',
                $html,
            ),
            'og:url must point at the canonical /u/{id} address.',
        );
    }

    /** The card badge falls back to the community average, like /r does. */
    public function test_recipe_card_falls_back_to_community_average_for_reality(): void
    {
        $cook = $this->cook();
        $this->ownedRecipe($cook, [
            'reality_minutes' => null,
            'reality_source' => null,
            'community_avg_minutes' => 62.5,
        ]);

        $html = $this->get("/u/{$cook->id}")->getContent();
        $this->assertStringContainsString('Really takes 63 min', $html);
    }

    /** Internal account fields (name, email, gender) never render. */
    public function test_profile_page_never_leaks_internal_account_fields(): void
    {
        $cook = $this->cook([
            'name' => 'SecretInternalName',
            'email' => 'secret@internal.test',
            'gender' => 'female',
        ]);

        $html = $this->get("/u/{$cook->id}")->getContent();
        $this->assertStringNotContainsString('SecretInternalName', $html);
        $this->assertStringNotContainsString('secret@internal.test', $html);
        $this->assertStringNotContainsString('female', $html);
        // The public identity is still there.
        $this->assertStringContainsString('Chef Amal', $html);
    }

    /** No display name → the neutral "A cook" fallback + initials tile. */
    public function test_profile_page_falls_back_when_display_name_missing(): void
    {
        $cook = $this->cook(['display_name' => null, 'avatar_url' => null, 'bio' => null]);

        $html = $this->get("/u/{$cook->id}")->getContent();
        $this->assertStringContainsString('A cook', $html);
        // No avatar → no og:image and the initials tile renders instead.
        $this->assertStringNotContainsString('og:image', $html);
        $this->assertStringContainsString('avatar-fallback', $html);
        // Bio omitted → the localized fallback line.
        $this->assertStringContainsString('Home cook sharing honest recipes', $html);
    }

    /** Unknown ids 404. */
    public function test_profile_page_404s_for_unknown_ids(): void
    {
        $this->get('/u/999999')->assertNotFound();
    }

    /** A cook with zero recipes renders the card but no recipe grid. */
    public function test_profile_page_without_recipes_renders_no_grid(): void
    {
        $cook = $this->cook();

        $html = $this->get("/u/{$cook->id}")->getContent();
        // Element-level checks: the stylesheet itself mentions .grid/.rcard.
        $this->assertStringNotContainsString('<section class="recipes"', $html);
        $this->assertStringNotContainsString('<a class="rcard"', $html);
        // Counts and banner still render (page is not empty).
        $this->assertStringContainsString('<strong>0</strong> Recipes', $html);
    }

    /** The rendered page is cached per user and still serves correctly. */
    public function test_profile_page_second_hit_serves_from_cache(): void
    {
        $cook = $this->cook();

        $this->get("/u/{$cook->id}")->assertOk();
        // Second hit resolves through the 5-minute cache entry.
        $this->get("/u/{$cook->id}")->assertOk();
    }
}
