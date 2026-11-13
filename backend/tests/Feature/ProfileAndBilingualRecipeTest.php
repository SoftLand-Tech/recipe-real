<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeImport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ProfileAndBilingualRecipeTest extends TestCase
{
    use RefreshDatabase;

    public function test_posts_user_id_filter_and_cache_isolation(): void
    {
        $viewer = User::factory()->create();
        $alice = User::factory()->create();
        $bob = User::factory()->create();

        $alicePost = Post::create(['user_id' => $alice->id, 'body' => 'Alice post']);
        $bobPost = Post::create(['user_id' => $bob->id, 'body' => 'Bob post']);

        // Prime global page-1 caches for both cached sorts.
        foreach (['suggested', 'trending'] as $sort) {
            $global = $this->actingAs($viewer, 'sanctum')
                ->getJson("/api/posts?sort={$sort}")
                ->assertOk();
            $this->assertCount(2, $global->json('data'));
        }

        // Filtering by user_id must return only that user's posts even when
        // global page-1 cache is warm, and must not overwrite the global cache.
        foreach (['suggested', 'trending'] as $sort) {
            $aliceFeed = $this->actingAs($viewer, 'sanctum')
                ->getJson("/api/posts?user_id={$alice->id}&sort={$sort}")
                ->assertOk();
            $this->assertSame([$alicePost->id], array_column($aliceFeed->json('data'), 'id'));

            $bobFeed = $this->actingAs($viewer, 'sanctum')
                ->getJson("/api/posts?user_id={$bob->id}&sort={$sort}")
                ->assertOk();
            $this->assertSame([$bobPost->id], array_column($bobFeed->json('data'), 'id'));

            $globalAfter = $this->actingAs($viewer, 'sanctum')
                ->getJson("/api/posts?sort={$sort}")
                ->assertOk();
            $this->assertCount(2, $globalAfter->json('data'));
        }

        // A new post by Bob appears immediately when querying user_id=bob
        // (user_id queries bypass CommunityFeedCache).
        $bobSecond = Post::create(['user_id' => $bob->id, 'body' => 'Bob second post']);
        $bobUpdated = $this->actingAs($viewer, 'sanctum')
            ->getJson("/api/posts?user_id={$bob->id}&sort=suggested")
            ->assertOk();
        $bobIds = array_column($bobUpdated->json('data'), 'id');
        $this->assertContains($bobPost->id, $bobIds);
        $this->assertContains($bobSecond->id, $bobIds);
        $this->assertNotContains($alicePost->id, $bobIds);
    }

    public function test_public_user_recipes_endpoint_and_email_privacy(): void
    {
        $alice = User::factory()->create(['email' => 'alice@example.test']);
        $bob = User::factory()->create(['email' => 'bob@example.test']);

        $aliceRecipe = Recipe::create([
            'owner_id' => $alice->id,
            'source_type' => 'user',
            'title' => 'Alice Shakshouka',
            'publisher_time_minutes' => 25,
        ]);
        Recipe::create([
            'owner_id' => $bob->id,
            'source_type' => 'user',
            'title' => 'Bob Mansaf',
            'publisher_time_minutes' => 60,
        ]);

        $res = $this->getJson("/api/users/{$alice->id}/recipes")->assertOk();
        $this->assertSame([$aliceRecipe->id], array_column($res->json('data'), 'id'));
        $this->assertSame('Alice Shakshouka', $res->json('data.0.title'));

        // Public profile must never expose email; /users/me/profile includes it.
        $publicProfile = $this->getJson("/api/users/{$alice->id}/profile")->assertOk();
        $this->assertArrayNotHasKey('email', $publicProfile->json('user'));

        $myProfile = $this->actingAs($alice, 'sanctum')
            ->getJson('/api/users/me/profile')
            ->assertOk();
        $this->assertSame('alice@example.test', $myProfile->json('user.email'));
    }

    public function test_create_and_update_recipe_with_arabic_only_title_and_steps(): void
    {
        $user = User::factory()->create();

        $createRes = $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipes', [
                'title_ar' => 'كفتة بالطحينة',
                'estimated_minutes' => 35,
                'ingredients' => ['٥٠٠ جم لحم مفروم'],
                'steps' => [
                    [
                        'description_ar' => 'تُشكّل الكفتة وتُخبز في الفرن.',
                        'minutes_estimated' => 20,
                        'step_type' => 'passive',
                    ],
                ],
            ])
            ->assertCreated();

        $recipeId = (int) $createRes->json('data.id');
        $this->assertDatabaseHas('recipes', [
            'id' => $recipeId,
            'title' => 'كفتة بالطحينة',
            'title_ar' => 'كفتة بالطحينة',
        ]);
        $this->assertDatabaseHas('recipe_steps', [
            'recipe_id' => $recipeId,
            'step_number' => 1,
            'description' => 'تُشكّل الكفتة وتُخبز في الفرن.',
            'description_ar' => 'تُشكّل الكفتة وتُخبز في الفرن.',
        ]);

        // Update with Arabic-only title & step (no English fields).
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/recipes/{$recipeId}", [
                'title' => null,
                'title_ar' => 'كفتة بالبطاطس',
                'steps' => [
                    [
                        'description' => '   ',
                        'description_ar' => 'تُضاف شرائح البطاطس وتُخبز.',
                        'minutes_estimated' => 25,
                        'step_type' => 'passive',
                    ],
                ],
            ])
            ->assertOk();

        $this->assertDatabaseHas('recipes', [
            'id' => $recipeId,
            'title' => 'كفتة بالبطاطس',
            'title_ar' => 'كفتة بالبطاطس',
        ]);
        $this->assertDatabaseHas('recipe_steps', [
            'recipe_id' => $recipeId,
            'step_number' => 1,
            'description' => 'تُضاف شرائح البطاطس وتُخبز.',
            'description_ar' => 'تُضاف شرائح البطاطس وتُخبز.',
        ]);
    }

    public function test_publish_import_with_arabic_only_title_and_steps(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        config(['admin.emails' => $user->email]);

        $import = RecipeImport::create([
            'requested_by' => $user->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_platform' => 'instagram',
            'source_url' => 'https://www.instagram.com/reel/arabic-only/',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
            'draft' => ['title_ar' => 'ملوخية'],
        ]);

        $res = $this->actingAs($user, 'sanctum')
            ->postJson("/api/recipe-imports/{$import->id}/publish", [
                'title_ar' => 'ملوخية بالدجاج',
                'estimated_minutes' => 45,
                'ingredients' => ['دجاج', 'ملوخية'],
                'steps' => [
                    [
                        'description_ar' => 'اسلق الدجاج حتى ينضج.',
                        'minutes_estimated' => 30,
                        'step_type' => 'passive',
                    ],
                ],
            ])
            ->assertCreated();

        $recipeId = (int) $res->json('data.id');
        $this->assertDatabaseHas('recipes', [
            'id' => $recipeId,
            'title' => 'ملوخية بالدجاج',
            'title_ar' => 'ملوخية بالدجاج',
        ]);
        $this->assertDatabaseHas('recipe_steps', [
            'recipe_id' => $recipeId,
            'step_number' => 1,
            'description' => 'اسلق الدجاج حتى ينضج.',
            'description_ar' => 'اسلق الدجاج حتى ينضج.',
        ]);
    }

    public function test_recipe_endpoints_reject_empty_or_whitespace_bilingual_title_and_steps(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        config(['admin.emails' => $user->email]);

        // Store: both title and title_ar blank/whitespace, and both step descriptions blank.
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipes', [
                'title' => '   ',
                'title_ar' => '',
                'estimated_minutes' => 15,
                'ingredients' => ['Salt'],
                'steps' => [
                    ['description' => '  ', 'description_ar' => "\t\n"],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'title',
                'title_ar',
                'steps.0.description',
                'steps.0.description_ar',
            ]);

        // Update: clearing both title and title_ar or step descriptions fails.
        $recipe = Recipe::create([
            'owner_id' => $user->id,
            'source_type' => 'user',
            'title' => 'Existing Title',
            'publisher_time_minutes' => 15,
        ]);
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/recipes/{$recipe->id}", [
                'title' => '  ',
                'title_ar' => null,
                'steps' => [
                    ['description' => '', 'description_ar' => '   '],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'title',
                'title_ar',
                'steps.0.description',
                'steps.0.description_ar',
            ]);

        // Publish import: empty/whitespace title & step descriptions fail.
        $import = RecipeImport::create([
            'requested_by' => $user->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_platform' => 'instagram',
            'source_url' => 'https://www.instagram.com/reel/invalid-empty/',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
            'draft' => [],
        ]);
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/recipe-imports/{$import->id}/publish", [
                'title' => '',
                'title_ar' => '   ',
                'estimated_minutes' => 20,
                'ingredients' => ['Water'],
                'steps' => [
                    ['description' => '   ', 'description_ar' => ''],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'title',
                'title_ar',
                'steps.0.description',
                'steps.0.description_ar',
            ]);
    }
}
