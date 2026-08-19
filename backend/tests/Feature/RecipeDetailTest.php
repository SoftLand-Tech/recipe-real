<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RecipeDetailTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Regression for the 2026-08-19 prod 500s: the de-premiuming edit
     * removed the `use App\Models\RecipeView;` import while leaving the
     * informational view-recording call in show(), so EVERY signed-in
     * detail request crashed ("Class ...Controllers\Api\RecipeView not
     * found"). Anonymous requests passed, which is exactly why curl-based
     * checks missed it — this test pins the authenticated path.
     */
    public function test_signed_in_recipe_detail_returns_200_and_records_view(): void
    {
        $recipe = Recipe::create([
            'title' => 'Test Curry',
            'source_type' => 'foodcom',
            'ingredients' => json_encode(['curry paste', 'coconut milk']),
            'steps' => json_encode([['description' => 'Simmer.']]),
            'steps_count' => 1,
        ]);
        RecipeStep::create([
            'recipe_id' => $recipe->id,
            'step_number' => 1,
            'description' => 'Simmer.',
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/recipes/{$recipe->id}");

        $response->assertOk();
        $this->assertDatabaseHas('recipe_views', [
            'user_id' => $user->id,
            'recipe_id' => $recipe->id,
            'month_key' => now()->format('Y-m'),
        ]);
    }
}
