<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public share pages (/p/{post}, /r/{recipe}) cache rendered HTML for
 * 5 minutes per id per locale. Any write that changes what they render must
 * forget the affected keys, or edits serve stale pages — including stale
 * OpenGraph tags, which chat apps pin far beyond our TTL.
 *
 * Covered: post edit → /p; profile name/avatar → authored /p pages;
 * recipe edit → /r + attached /p cards; recipe delete → attached /p cards
 * drop the dead link; quick-time → /r "Really takes" badge.
 */
class ShareCacheTest extends TestCase
{
    use RefreshDatabase;

    /** Editing a post's body refreshes its share page (both locales' keys). */
    public function test_post_edit_refreshes_share_page(): void
    {
        $author = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Original share body.',
        ]);

        $this->get("/p/{$post->id}")->assertOk()->assertSee('Original share body.');

        $this->actingAs($author, 'sanctum')
            ->patchJson("/api/posts/{$post->id}", ['body' => 'Edited share body.'])
            ->assertOk();

        $this->get("/p/{$post->id}")
            ->assertOk()
            ->assertSee('Edited share body.')
            ->assertDontSee('Original share body.');
    }

    /** A display-name change refreshes every /p page the user authored. */
    public function test_profile_name_change_refreshes_authored_share_pages(): void
    {
        $author = User::factory()->create(['display_name' => 'Old Name']);
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Name change body.',
        ]);

        $this->get("/p/{$post->id}")->assertOk()->assertSee('Old Name');

        $this->actingAs($author, 'sanctum')
            ->patchJson('/api/users/me/profile', ['display_name' => 'New Name'])
            ->assertOk();

        $this->get("/p/{$post->id}")
            ->assertOk()
            ->assertSee('New Name')
            ->assertDontSee('Old Name');
    }

    /** A recipe edit refreshes /r and the card on attached /p pages. */
    public function test_recipe_edit_refreshes_recipe_and_attached_post_pages(): void
    {
        $author = User::factory()->create();
        $recipe = Recipe::create([
            'title' => 'Original Share Title',
            'source_type' => 'user',
            'owner_id' => $author->id,
        ]);
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Attached try body.',
            'recipe_id' => $recipe->id,
        ]);

        $this->get("/r/{$recipe->id}")->assertOk()->assertSee('Original Share Title');
        $this->get("/p/{$post->id}")->assertOk()->assertSee('Original Share Title');

        $this->actingAs($author, 'sanctum')
            ->patchJson("/api/recipes/{$recipe->id}", ['title' => 'Edited Share Title'])
            ->assertOk();

        $this->get("/r/{$recipe->id}")
            ->assertOk()
            ->assertSee('Edited Share Title')
            ->assertDontSee('Original Share Title');
        $this->get("/p/{$post->id}")
            ->assertOk()
            ->assertSee('Edited Share Title')
            ->assertDontSee('Original Share Title');
    }

    /** Deleting a recipe drops the dead card link from attached /p pages. */
    public function test_recipe_delete_drops_card_from_attached_post_page(): void
    {
        $author = User::factory()->create();
        $recipe = Recipe::create([
            'title' => 'Doomed Share Title',
            'source_type' => 'user',
            'owner_id' => $author->id,
        ]);
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Doomed try body.',
            'recipe_id' => $recipe->id,
        ]);

        $this->get("/p/{$post->id}")->assertOk()->assertSee("/r/{$recipe->id}", false);

        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/recipes/{$recipe->id}")
            ->assertStatus(204);

        $this->get("/p/{$post->id}")
            ->assertOk()
            ->assertDontSee("/r/{$recipe->id}", false);
    }

    /** A quick-time log refreshes the /r "Really takes" badge. */
    public function test_quick_time_refreshes_recipe_share_badge(): void
    {
        $user = User::factory()->create();
        $recipe = Recipe::create([
            'title' => 'Badge Share Stew',
            'source_type' => 'foodcom',
            'publisher_time_minutes' => 25,
        ]);

        $this->get("/r/{$recipe->id}")->assertOk()->assertDontSee('Really takes 40 min');

        $this->actingAs($user, 'sanctum')->postJson(
            "/api/recipes/{$recipe->id}/quick-time",
            ['minutes' => 40]
        )->assertStatus(201);

        $this->get("/r/{$recipe->id}")->assertOk()->assertSee('Really takes 40 min');
    }
}
