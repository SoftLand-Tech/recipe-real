<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Models\TimingSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Full Cook Mode sessions must move the same aggregates one-tap quick-time
 * logs move (previously store() wrote the session + timing submissions but
 * never recomputed community_avg_minutes, per-step averages or the Reality
 * Index — "Really takes" ignored the main cooking flow forever), and both
 * timing writes must bust the shared timing caches (home rails, reality
 * leaderboard) so the new figures show on the next read.
 */
class CookSessionTimingTest extends TestCase
{
    use RefreshDatabase;

    private function makeTimedRecipe(array $overrides = []): Recipe
    {
        $recipe = Recipe::create(array_merge([
            'title' => 'Timed Test Stew',
            'source_type' => 'foodcom',
            'image_url' => 'https://example.com/stew.jpg',
            'steps_count' => 2,
            'aggregated_rating' => 4.5,
            'review_count' => 12,
            'publisher_time_minutes' => 20,
        ], $overrides));

        RecipeStep::create([
            'recipe_id' => $recipe->id,
            'step_number' => 1,
            'description' => 'Chop everything.',
            'step_type' => 'active',
        ]);
        RecipeStep::create([
            'recipe_id' => $recipe->id,
            'step_number' => 2,
            'description' => 'Simmer low and slow.',
            'step_type' => 'passive',
        ]);

        return $recipe;
    }

    /** A full session folds its total + per-step timings into the aggregates. */
    public function test_full_cook_session_updates_community_averages_and_reality(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeTimedRecipe();
        $stepIds = RecipeStep::where('recipe_id', $recipe->id)->orderBy('id')->pluck('id')->all();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/cook-sessions', [
            'recipe_id' => $recipe->id,
            'total_actual_minutes' => 50,
            'cleanup_minutes' => 8,
            'feedback' => 'as_expected',
            'timing_submissions' => [
                ['recipe_step_id' => $stepIds[0], 'actual_minutes' => 20],
                ['recipe_step_id' => $stepIds[1], 'actual_minutes' => 30],
            ],
        ]);
        $response->assertStatus(201);

        $recipe->refresh();
        $this->assertEquals(50, (float) $recipe->community_avg_minutes);
        $this->assertEquals(8, (float) $recipe->cleanup_avg_minutes);
        $this->assertSame('community', $recipe->reality_source);
        $this->assertEquals(50, (float) $recipe->reality_minutes);
        $this->assertSame(1, (int) $recipe->reality_samples);

        $this->assertEquals(
            20,
            (float) RecipeStep::find($stepIds[0])->community_avg_minutes
        );
        $this->assertEquals(
            30,
            (float) RecipeStep::find($stepIds[1])->community_avg_minutes
        );
    }

    /** An idempotent retry returns the old session without double-counting. */
    public function test_idempotent_retry_does_not_recompute_aggregates(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeTimedRecipe();
        $stepIds = RecipeStep::where('recipe_id', $recipe->id)->orderBy('id')->pluck('id')->all();
        $key = '123e4567-e89b-12d3-a456-426614174000';

        $payload = [
            'recipe_id' => $recipe->id,
            'total_actual_minutes' => 50,
            'idempotency_key' => $key,
            'timing_submissions' => [
                ['recipe_step_id' => $stepIds[0], 'actual_minutes' => 50],
            ],
        ];

        $this->actingAs($user, 'sanctum')->postJson('/api/cook-sessions', $payload)->assertStatus(201);
        $this->actingAs($user, 'sanctum')->postJson('/api/cook-sessions', $payload)->assertStatus(200);

        $this->assertSame(1, TimingSubmission::where('recipe_step_id', $stepIds[0])->count());
        $recipe->refresh();
        $this->assertEquals(50, (float) $recipe->community_avg_minutes);
        $this->assertSame(1, (int) $recipe->reality_samples);
    }

    /** quick-time moves the recipe across rails/leaderboard immediately. */
    public function test_quick_time_busts_home_and_reality_caches(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeTimedRecipe(); // publisher 20 → inside easy_wins (<=30)

        // Prime both caches: rail holds the recipe with no community avg,
        // leaderboard has no community signal yet.
        $home = $this->getJson('/api/home')->assertOk();
        $easyIds = collect($home->json('data.easy_wins'))->pluck('id')->all();
        $this->assertContains($recipe->id, $easyIds);

        $this->actingAs($user, 'sanctum')->postJson(
            "/api/recipes/{$recipe->id}/quick-time",
            ['minutes' => 55]
        )->assertStatus(201);

        // Fresh read: 55 min no longer qualifies for easy_wins…
        $home = $this->getJson('/api/home')->assertOk();
        $easyIds = collect($home->json('data.easy_wins'))->pluck('id')->all();
        $this->assertNotContains($recipe->id, $easyIds);

        // …and the leaderboard now ranks it as most underestimated.
        $reality = $this->getJson('/api/reality?mode=under')->assertOk();
        $this->assertSame($recipe->id, $reality->json('data.0.id'));
    }

    /** A full session busts the same caches a quick-time log busts. */
    public function test_full_session_busts_home_and_reality_caches(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeTimedRecipe();
        $stepIds = RecipeStep::where('recipe_id', $recipe->id)->orderBy('id')->pluck('id')->all();

        $this->getJson('/api/home')->assertOk();
        $this->getJson('/api/reality?mode=under')->assertOk();

        $this->actingAs($user, 'sanctum')->postJson('/api/cook-sessions', [
            'recipe_id' => $recipe->id,
            'total_actual_minutes' => 55,
            'timing_submissions' => [
                ['recipe_step_id' => $stepIds[0], 'actual_minutes' => 55],
            ],
        ])->assertStatus(201);

        $home = $this->getJson('/api/home')->assertOk();
        $easyIds = collect($home->json('data.easy_wins'))->pluck('id')->all();
        $this->assertNotContains($recipe->id, $easyIds);

        $reality = $this->getJson('/api/reality?mode=under')->assertOk();
        $this->assertSame($recipe->id, $reality->json('data.0.id'));
    }
}
