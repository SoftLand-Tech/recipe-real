<?php

namespace Tests\Feature\RecipeDedup;

use App\Jobs\IndexRecipe;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Models\User;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeImport\RecipePublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\TestCase;

final class PublisherHookTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    /** @var array<string, mixed> minimal valid publish() payload */
    private array $draft;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->draft = [
            'title' => 'Hook test shakshuka',
            'description' => 'Eggs poached in a spiced tomato pan.',
            'ingredients' => ['4 eggs', '400 g tomatoes', '1 tbsp olive oil'],
            'steps' => [
                ['description' => 'Simmer the tomatoes.', 'minutes_estimated' => 10, 'step_type' => 'active'],
                ['description' => 'Poach the eggs in the sauce.', 'minutes_estimated' => 8, 'step_type' => 'active'],
            ],
            'estimated_minutes' => 25,
            'servings' => 2,
            'prep_time_minutes' => 7,
            'cook_time_minutes' => 18,
            'category' => 'Breakfast',
            'keywords' => ['shakshuka', 'eggs'],
        ];

        config([
            'recipe_dedup.enabled' => true,
            'recipe_dedup.indexing.enabled' => true,
            'recipe_dedup.embeddings.enabled' => true,
            'recipe_dedup.indexing.embed_immediately' => true,
        ]);
    }

    public function test_publish_dispatches_the_index_recipe_hook(): void
    {
        Queue::fake();

        $recipe = app(RecipePublisher::class)->publish($this->owner, $this->draft);

        Queue::assertPushed(IndexRecipe::class, 1);
        Queue::assertPushed(IndexRecipe::class, fn (IndexRecipe $job): bool => $job->recipeId === (int) $recipe->id);
    }

    public function test_publish_hook_runs_to_get_a_fingerprint_and_an_embedding(): void
    {
        $this->swap(EmbeddingProvider::class, new FakeEmbeddingProvider);
        $this->swap(VectorStore::class, new FakeVectorStore);

        $recipe = app(RecipePublisher::class)->publish($this->owner, $this->draft);

        // The queued run is inline (QUEUE_CONNECTION=sync): the hook ran
        // right after the committed transaction.
        $fingerprint = RecipeFingerprint::query()->where('recipe_id', $recipe->id)->firstOrFail();
        $this->assertTrue($fingerprint->is_complete);
        $this->assertSame(CulinaryIdentity::VERSION, (int) $fingerprint->version);

        $embedding = RecipeEmbedding::query()->where('recipe_id', $recipe->id)->firstOrFail();
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $embedding->status);
    }

    public function test_publish_skips_the_hook_when_indexing_is_disabled(): void
    {
        config(['recipe_dedup.indexing.enabled' => false]);
        Queue::fake();

        $recipe = app(RecipePublisher::class)->publish($this->owner, $this->draft);

        $this->assertNotNull($recipe);
        Queue::assertNotPushed(IndexRecipe::class);
    }
}
