<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
