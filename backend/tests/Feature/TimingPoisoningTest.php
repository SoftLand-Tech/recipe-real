<?php

namespace Tests\Feature;

use App\Models\CookSession;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Models\TimingSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Quick-time anti-poisoning guards: the community "Really takes" data must
 * resist a single account dominating it.
 *
 * 1. One quick-time log per user per recipe per 24h (quick-time rows are
 *    cook_sessions with source = 'quick').
 * 2. Once >= 5 real sessions exist, a quick-time deviating more than 5x
 *    from reality_minutes is rejected.
 * 3. Community averages cap every user at their 5 most recent contribution
 *    rows before averaging (Recipe::refreshCommunityTiming).
 */
class TimingPoisoningTest extends TestCase
{
    use RefreshDatabase;

    private function makeRecipe(): Recipe
    {
        $recipe = Recipe::create([
            'title' => 'Poison Test Stew',
            'source_type' => 'foodcom',
            'image_url' => 'https://example.com/stew.jpg',
            'steps_count' => 2,
            'aggregated_rating' => 4.5,
            'review_count' => 12,
            'publisher_time_minutes' => 20,
        ]);

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

    private function postQuickTime(User $user, Recipe $recipe, float $minutes)
    {
        return $this->actingAs($user, 'sanctum')->postJson(
            "/api/recipes/{$recipe->id}/quick-time",
            ['minutes' => $minutes]
        );
    }

    /** The same user cannot quick-time the same recipe twice in 24h. */
    public function test_second_quick_time_within_24h_is_rejected(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeRecipe();

        $this->postQuickTime($user, $recipe, 45)->assertStatus(201);

        $response = $this->postQuickTime($user, $recipe, 30)->assertStatus(422);
        $this->assertSame(
            'You already logged a time for this recipe today. You can log again tomorrow.',
            $response->json('message')
        );

        // The rejected attempt must not have created a session.
        $this->assertSame(
            1,
            CookSession::query()
                ->where('user_id', $user->id)
                ->where('recipe_id', $recipe->id)
                ->where('source', 'quick')
                ->count()
        );
    }

    /** Backdating the last quick-time beyond 24h re-opens the tap. */
    public function test_quick_time_allowed_again_after_24h(): void
    {
        $user = User::factory()->create();
        $recipe = $this->makeRecipe();

        $this->postQuickTime($user, $recipe, 45)->assertStatus(201);

        // Travel 25h back: the dedupe window no longer contains the row.
        CookSession::query()
            ->where('user_id', $user->id)
            ->where('recipe_id', $recipe->id)
            ->update(['created_at' => now()->subHours(25)]);

        $this->postQuickTime($user, $recipe, 30)->assertStatus(201);
        $this->assertSame(
            2,
            CookSession::query()
                ->where('user_id', $user->id)
                ->where('recipe_id', $recipe->id)
                ->where('source', 'quick')
                ->count()
        );
    }

    /** With >= 5 real sessions, a 5x-off quick-time is rejected; a sane one passes. */
    public function test_quick_time_far_from_reality_is_rejected_but_close_is_accepted(): void
    {
        $recipe = $this->makeRecipe();

        // 5 real community sessions of 40 min from other cooks.
        $cooks = User::factory()->count(5)->create();
        foreach ($cooks as $cook) {
            CookSession::create([
                'user_id' => $cook->id,
                'recipe_id' => $recipe->id,
                'total_actual_minutes' => 40,
            ]);
        }
        $recipe->refreshCommunityTiming();

        $this->assertSame('community', $recipe->reality_source);
        $this->assertSame(5, (int) $recipe->reality_samples);
        $this->assertEqualsWithDelta(40.0, (float) $recipe->reality_minutes, 0.1);

        $user = User::factory()->create();

        // 5 min is 8x under the measured 40 → sanity rejection.
        $this->postQuickTime($user, $recipe, 5)->assertStatus(422)
            ->assertJsonPath(
                'message',
                'That time is far from what cooks measured for this recipe (40 min). If that is accurate, use Cook Mode so it counts fully.'
            );

        // 45 min is within 5x of 40 → accepted.
        $this->postQuickTime($user, $recipe, 45)->assertStatus(201);
    }

    /** The community average caps each user at their 5 most recent rows. */
    public function test_community_average_caps_each_user_at_five_rows(): void
    {
        $recipe = $this->makeRecipe();
        $spammer = User::factory()->create();
        $honest = User::factory()->create();

        // 20 quick-time rows from the spammer: oldest 15 rows say 100 min,
        // the newest 5 say 10 min, all with varied created_at.
        foreach (range(1, 20) as $i) {
            CookSession::create([
                'user_id' => $spammer->id,
                'recipe_id' => $recipe->id,
                'total_actual_minutes' => $i <= 15 ? 100 : 10,
                'source' => 'quick',
                'created_at' => now()->subHours(21 - $i),
            ]);
        }

        // 5 rows from an honest cook at 30 min each.
        foreach (range(1, 5) as $i) {
            CookSession::create([
                'user_id' => $honest->id,
                'recipe_id' => $recipe->id,
                'total_actual_minutes' => 30,
                'source' => 'quick',
                'created_at' => now()->subHours($i),
            ]);
        }

        $recipe->refreshCommunityTiming();

        // Capped: spammer contributes its newest 5 rows (10 min each) plus
        // the honest cook's 5 rows (30 min each) → (5*10 + 5*30) / 10 = 20.
        // Uncapped, the 100-min spam rows would drag it to 68.
        $this->assertEqualsWithDelta(20.0, (float) $recipe->community_avg_minutes, 0.1);
        $this->assertEqualsWithDelta(20.0, (float) $recipe->reality_minutes, 0.1);
        $this->assertSame('community', $recipe->reality_source);
    }

    /** Per-step averages use the same per-user cap. */
    public function test_per_step_average_caps_each_user_at_five_rows(): void
    {
        $recipe = $this->makeRecipe();
        $stepId = RecipeStep::query()
            ->where('recipe_id', $recipe->id)
            ->orderBy('id')
            ->first()
            ->id;

        $spammer = User::factory()->create();

        // Oldest 3 submissions say 1000 min, newest 5 say 100 min.
        foreach ([[3, 1000], [5, 100]] as [$count, $minutes]) {
            foreach (range(1, $count) as $i) {
                TimingSubmission::create([
                    'user_id' => $spammer->id,
                    'recipe_step_id' => $stepId,
                    'actual_minutes' => $minutes,
                    'session_id' => (string) Str::uuid(),
                ]);
            }
        }

        $recipe->refreshCommunityTiming();

        // Capped to the spammer's newest 5 rows → 100, not 437.5 uncapped.
        $this->assertEqualsWithDelta(
            100.0,
            (float) RecipeStep::find($stepId)->community_avg_minutes,
            0.1
        );
    }
}
