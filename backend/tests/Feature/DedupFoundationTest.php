<?php

namespace Tests\Feature;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Models\RecipeGenerationBatch;
use App\Models\RecipeGenerationBatchItem;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator;
use App\Services\RecipeDedup\Contracts\VectorStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\TestCase;
use Throwable;

class DedupFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_dedup_tables_exist(): void
    {
        foreach ([
            'recipe_fingerprints',
            'recipe_embeddings',
            'duplicate_checks',
            'recipe_duplicate_pairs',
            'recipe_generation_batches',
            'recipe_generation_batch_items',
        ] as $table) {
            $this->assertTrue(DB::getSchemaBuilder()->hasTable($table), "Missing table {$table}");
        }
    }

    public function test_fingerprint_unique_constraints_guard_the_database(): void
    {
        $a = Recipe::create(['title' => 'A', 'steps_count' => 2]);
        $b = Recipe::create(['title' => 'B', 'steps_count' => 2]);

        RecipeFingerprint::create([
            'recipe_id' => $a->id,
            'fingerprint' => 'deadbeefcafebabe0123',
            'identity_signature' => 'sig-1',
            'ingredient_combo_hash' => 'combo-1',
            'main_ingredient_hash' => 'main-1',
            'title_signature' => 'title-1',
        ]);

        // One row per recipe.
        try {
            RecipeFingerprint::create([
                'recipe_id' => $a->id,
                'fingerprint' => 'another-hash',
                'identity_signature' => 'sig-2',
                'ingredient_combo_hash' => 'combo-2',
                'main_ingredient_hash' => 'main-2',
                'title_signature' => 'title-2',
            ]);
            $this->fail('Unique recipe_id constraint missing.');
        } catch (Throwable) {
            $this->addToAssertionCount(1);
        }

        // The race-condition guard: two recipes cannot claim one fingerprint.
        try {
            RecipeFingerprint::create([
                'recipe_id' => $b->id,
                'fingerprint' => 'deadbeefcafebabe0123',
                'identity_signature' => 'sig-3',
                'ingredient_combo_hash' => 'combo-3',
                'main_ingredient_hash' => 'main-3',
                'title_signature' => 'title-3',
            ]);
            $this->fail('Unique fingerprint constraint missing.');
        } catch (Throwable) {
            $this->addToAssertionCount(1);
        }

        $this->assertSame(1, RecipeFingerprint::query()->count());
    }

    public function test_embedding_rows_are_unique_per_recipe_and_track_status(): void
    {
        $recipe = Recipe::create(['title' => 'A']);

        RecipeEmbedding::create([
            'recipe_id' => $recipe->id,
            'status' => RecipeEmbedding::STATUS_INDEXED,
            'model' => 'test-model',
            'text_hash' => str_repeat('a', 64),
            'indexed_at' => now(),
        ]);

        $row = RecipeEmbedding::query()->where('recipe_id', $recipe->id)->firstOrFail();
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $row->status);
        $this->assertSame('test-model', $row->model);
    }

    public function test_duplicate_history_and_pairs_round_trip(): void
    {
        $new = Recipe::create(['title' => 'New']);
        $old = Recipe::create(['title' => 'Old']);

        $check = DuplicateCheck::create([
            'recipe_id' => $new->id,
            'matched_recipe_id' => $old->id,
            'source' => DuplicateCheck::SOURCE_GENERATION,
            'layer' => 3,
            'action' => DuplicateCheck::ACTION_REJECTED_DUPLICATE,
            'is_duplicate' => true,
            'scores' => ['total' => 0.93],
            'classification' => 'duplicate',
            'ai_confidence' => 0.97,
            'reason' => 'Same traditional carbonara preparation.',
            'differences' => ['Slightly different ingredient quantities'],
        ]);

        $pair = RecipeDuplicatePair::create([
            'recipe_id' => $new->id,
            'duplicate_of_recipe_id' => $old->id,
            'source' => 'engine',
            'status' => RecipeDuplicatePair::STATUS_FLAGGED,
            'check_id' => $check->id,
        ]);

        $this->assertSame('Same traditional carbonara preparation.', $check->reason);
        $this->assertTrue($check->fresh()->is_duplicate);
        $this->assertSame($check->id, $pair->check()->firstOrFail()->id);
        $this->assertSame('Old', $pair->duplicateOf()->firstOrFail()->title);
    }

    public function test_generation_batch_models_work(): void
    {
        $batch = RecipeGenerationBatch::create([
            'requested_count' => 100,
            'cuisine' => 'italian',
            'dish_family' => 'pasta',
            'status' => RecipeGenerationBatch::STATUS_CREATED,
            'max_attempts' => 300,
            'params' => ['brief' => 'Italian pasta'],
        ]);

        $item = RecipeGenerationBatchItem::create([
            'batch_id' => $batch->id,
            'action' => RecipeGenerationBatchItem::ACTION_DUPLICATE,
            'title' => 'Traditional Roman Carbonara',
            'layer' => 'exact',
            'reason' => 'Exact fingerprint match.',
        ]);

        $this->assertSame(100, $batch->remainingTarget());
        $this->assertSame($batch->id, $item->batch()->firstOrFail()->id);

        // A fresh batch is claimable exactly once while the lease holds.
        $this->assertTrue($batch->claimLease(60));
        $this->assertFalse($batch->claimLease(60));
        $this->assertTrue(RecipeGenerationBatch::query()->find($batch->id)
            ->lease_expires_at->isFuture());
    }

    public function test_dedup_provider_bindings_are_registered(): void
    {
        $this->assertTrue(app()->bound(VectorStore::class));
        $this->assertTrue(app()->bound(EmbeddingProvider::class));
        $this->assertTrue(app()->bound(AiDuplicateJudge::class));
        $this->assertTrue(app()->bound(RecipeCandidateGenerator::class));
    }

    public function test_fake_embedding_provider_is_deterministic(): void
    {
        $provider = new FakeEmbeddingProvider;
        $result = $provider->embed(['tomato soup', 'tomato soup', 'spaghetti carbonara']);

        $this->assertCount(3, $result->vectors);
        $this->assertSame($result->vectors[0], $result->vectors[1]);
        $this->assertNotSame($result->vectors[0], $result->vectors[2]);
        $norm = sqrt(array_sum(array_map(
            fn (float $value): float => $value * $value,
            $result->vectors[0],
        )));
        $this->assertEqualsWithDelta(1.0, $norm, 0.01);
    }

    public function test_fake_vector_store_searches_by_cosine_and_filters(): void
    {
        $store = new FakeVectorStore;
        $pasta = FakeEmbeddingProvider::vectorize('spaghetti carbonara pasta eggs guanciale');
        $soup = FakeEmbeddingProvider::vectorize('tomato soup basil');

        $store->upsertMany([
            ['id' => 1, 'vector' => $pasta, 'payload' => ['dish_family' => 'pasta']],
            ['id' => 2, 'vector' => $soup, 'payload' => ['dish_family' => 'soup']],
        ]);

        $hits = $store->search($pasta, 2);
        $this->assertSame(1, $hits[0]['recipe_id']);

        $filtered = $store->search($pasta, 2, ['dish_family' => 'soup']);
        $this->assertSame([2], array_column($filtered, 'recipe_id'));

        $store->delete(2);
        $this->assertCount(1, $store->search($soup, 5));
    }
}
