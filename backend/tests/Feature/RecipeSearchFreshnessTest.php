<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Title edits must be searchable immediately: UserRecipeController@update
 * queues a full FTS rebuild, which runs inline on the sync queue driver
 * (and via a worker in production). This pins the "my edit didn't take"
 * search-after-edit path — if the rebuild ever stops running, this fails.
 */
class RecipeSearchFreshnessTest extends TestCase
{
    use RefreshDatabase;

    public function test_updated_title_is_searchable_immediately(): void
    {
        $user = User::factory()->create();

        $created = $this->actingAs($user, 'sanctum')->postJson('/api/recipes', [
            'title' => 'Quinoa Zucchini Skillet Extraordinaire',
            'estimated_minutes' => 30,
            'ingredients' => ['rice', 'beans'],
            'steps' => [
                ['description' => 'Cook everything together.'],
                ['description' => 'Serve while hot.'],
            ],
        ])->assertStatus(201);
        $id = $created->json('data.id');

        $found = $this->getJson('/api/recipes/search?q=Quinoa')->assertOk();
        $this->assertContains($id, collect($found->json('data'))->pluck('id')->all());

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/recipes/{$id}", ['title' => 'Mushroom Barley Soup Extraordinaire'])
            ->assertOk();

        $found = $this->getJson('/api/recipes/search?q=Mushroom')->assertOk();
        $this->assertContains($id, collect($found->json('data'))->pluck('id')->all());

        $gone = $this->getJson('/api/recipes/search?q=Quinoa')->assertOk();
        $this->assertNotContains($id, collect($gone->json('data'))->pluck('id')->all());
    }

    public function test_arabic_title_and_ingredients_are_searchable_via_fts5(): void
    {
        $user = User::factory()->create();

        $created = $this->actingAs($user, 'sanctum')->postJson('/api/recipes', [
            'title' => 'Oven Roasted Herb Bird',
            'title_ar' => 'يخنة الدجاج بالأعشاب',
            'estimated_minutes' => 35,
            'ingredients' => ['poultry', 'garlic', 'lemon'],
            'ingredients_ar' => ['دجاجة كاملة', 'أرز أبيض', 'ليمون طازج'],
            'steps' => [
                ['description' => 'Season everything.', 'description_ar' => 'تبّل المكونات.'],
                ['description' => 'Simmer until tender.', 'description_ar' => 'اطهها حتى تنضج.'],
            ],
        ])->assertStatus(201);
        $id = $created->json('data.id');

        // Direct FTS lookup with and without Arabic definite article ("ال")
        foreach (['دجاج', 'الدجاج', 'ارز', 'ليمون'] as $query) {
            $res = $this->getJson('/api/recipes/search?q='.urlencode($query))->assertOk();
            $this->assertContains($id, collect($res->json('data'))->pluck('id')->all(), "Expected match for '{$query}'");
        }

        // Full index rebuild (used for bulk imports / nightly schedule) preserves Arabic hits
        $this->artisan('recipereal:rebuild-search')->assertSuccessful();
        $rebuilt = $this->getJson('/api/recipes/search?q='.urlencode('دجاج'))->assertOk();
        $this->assertContains($id, collect($rebuilt->json('data'))->pluck('id')->all());
    }

    public function test_arabic_like_fallback_matches_when_fts_index_is_empty(): void
    {
        $recipe = Recipe::create([
            'title' => 'Lemon Herb Stew',
            'title_ar' => 'يخنة الدجاج بالليمون',
            'source_type' => 'foodcom',
            'image_url' => 'https://example.com/stew.jpg',
            'ingredients' => ['poultry', 'lemon'],
            'ingredients_ar' => json_encode(['دجاج', 'ليمون'], JSON_UNESCAPED_UNICODE),
            'steps' => ['Simmer well.', 'Serve hot.'],
            'steps_count' => 2,
            'publisher_time_minutes' => 25,
        ]);

        DB::statement("INSERT INTO recipes_fts(recipes_fts) VALUES('delete-all')");

        $foundByTitle = $this->getJson('/api/recipes/search?q='.urlencode('دجاج'))->assertOk();
        $this->assertContains($recipe->id, collect($foundByTitle->json('data'))->pluck('id')->all());

        $foundByIngredient = $this->getJson('/api/recipes/search?q='.urlencode('ليمون'))->assertOk();
        $this->assertContains($recipe->id, collect($foundByIngredient->json('data'))->pluck('id')->all());
    }
}
