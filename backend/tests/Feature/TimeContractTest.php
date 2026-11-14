<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Models\RecipeStep;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TimeContractTest extends TestCase
{
    use RefreshDatabase;

    /**
     * End-to-end for the 2026-08-18 cooking-mode time contract:
     * recipereal:ai-apply must persist per-step literal_minutes (the alarm
     * anchor) alongside ai_minutes, and the recipe API must expose both the
     * per-step literal_minutes and the recipe-level time totals computed
     * from ai_minutes (total incl. cleanup, active/passive by step_type).
     */
    public function test_ai_apply_persists_literal_minutes_and_api_exposes_time_contract(): void
    {
        $recipe = Recipe::create([
            'title' => 'Test Chicken',
            'source_type' => 'foodcom',
            'ingredients' => json_encode(['1 chicken']),
            'steps' => json_encode([
                ['description' => 'Season the chicken.'],
                ['description' => 'Bake for 45 minutes.'],
                ['description' => 'Rest 10 minutes, then wash up.'],
            ]),
            'steps_count' => 3,
        ]);

        foreach (['Season the chicken.', 'Bake for 45 minutes.', 'Rest 10 minutes, then wash up.'] as $i => $desc) {
            RecipeStep::create([
                'recipe_id' => $recipe->id,
                'step_number' => $i + 1,
                'description' => $desc,
            ]);
        }

        $stepIds = DB::table('recipe_steps')->where('recipe_id', $recipe->id)->orderBy('step_number')->pluck('id')->all();
        $this->assertCount(3, $stepIds);

        $jsonl = json_encode([
            'id' => $recipe->id,
            'title_clean' => null,
            'title_ar' => 'دجاج تجريبي',
            'ingredients_ar' => ['1 دجاجة'],
            'steps' => [
                ['step_id' => $stepIds[0], 'description_ar' => 'تبّل الدجاج.', 'description_en' => null,
                    'minutes_estimated' => 3, 'step_type' => 'active', 'literal_minutes' => null],
                ['step_id' => $stepIds[1], 'description_ar' => 'اخبز 45 دقيقة.', 'description_en' => null,
                    'minutes_estimated' => 45, 'step_type' => 'passive', 'literal_minutes' => 45],
                ['step_id' => $stepIds[2], 'description_ar' => 'اتركه 10 دقائق ثم اغسل الأطباق.', 'description_en' => null,
                    'minutes_estimated' => 12, 'step_type' => 'cleanup', 'literal_minutes' => 10],
            ],
            'steps_ar' => ['تبّل الدجاج.', 'اخبز 45 دقيقة.', 'اتركه 10 دقائق ثم اغسل الأطباق.'],
            'servings' => null, 'category_clean' => null, 'junk' => false, 'notes' => '',
        ], JSON_UNESCAPED_UNICODE);

        $file = storage_path('app/time-contract-test.jsonl');
        file_put_contents($file, $jsonl);

        $this->artisan('recipereal:ai-apply', ['file' => $file])->assertSuccessful();

        // Step-level alarm anchor persisted, clamping untouched values.
        $this->assertDatabaseHas('recipe_steps', ['id' => $stepIds[0], 'ai_minutes' => 3, 'literal_minutes' => null]);
        $this->assertDatabaseHas('recipe_steps', ['id' => $stepIds[1], 'ai_minutes' => 45, 'literal_minutes' => 45]);
        $this->assertDatabaseHas('recipe_steps', ['id' => $stepIds[2], 'ai_minutes' => 12, 'literal_minutes' => 10]);

        // Re-running the same file is safe (idempotent import).
        $this->artisan('recipereal:ai-apply', ['file' => $file])->assertSuccessful();

        $response = $this->getJson("/api/recipes/{$recipe->id}");
        $response->assertOk();

        $payload = $response->json('data') ?? $response->json();

        // Recipe-level totals: total includes cleanup; active/passive split.
        $this->assertSame(60, $payload['time']['time_total_minutes']);
        $this->assertSame(3, $payload['time']['time_active_minutes']);
        $this->assertSame(45, $payload['time']['time_passive_minutes']);

        // Per-step alarm anchors: present only where the text states a time.
        $steps = collect($payload['recipe_steps'])->keyBy('id');
        $this->assertArrayNotHasKey('literal_minutes', $steps[$stepIds[0]]);
        $this->assertEquals(45, $steps[$stepIds[1]]['literal_minutes']);
        $this->assertEquals(10, $steps[$stepIds[2]]['literal_minutes']);

        @unlink($file);
    }

    /**
     * Recipes whose steps carry no ai_minutes (translations-only import)
     * must expose time: null — the client falls back to the stopwatch.
     */
    public function test_time_block_is_null_without_ai_minutes(): void
    {
        $recipe = Recipe::create([
            'title' => 'No Timings Yet',
            'source_type' => 'foodcom',
            'ingredients' => json_encode(['1 egg']),
            'steps' => json_encode([['description' => 'Fry the egg.']]),
            'steps_count' => 1,
        ]);

        $response = $this->getJson("/api/recipes/{$recipe->id}");
        $response->assertOk();

        $payload = $response->json('data') ?? $response->json();
        $this->assertNull($payload['time']);
    }
}
