<?php

namespace Tests\Feature\RecipeDedup;

use App\Models\Recipe;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Vector\NullVectorStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\TestCase;

class EmbeddingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_happy_path_indexes_the_recipe_and_upserts_the_vector_point(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $store = new FakeVectorStore;
        $service = new EmbeddingService(new FakeEmbeddingProvider, $store);

        $result = $service->ensureIndexedGivenIdentity($recipe->id, $this->identity(), null);

        $this->assertSame('indexed', $result);

        $row = RecipeEmbedding::query()->where('recipe_id', $recipe->id)->firstOrFail();
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $row->status);
        $this->assertSame('fake-embeddings-v1', $row->model);
        $this->assertSame(FakeEmbeddingProvider::DIMENSIONS, $row->dimensions);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{64}$/', (string) $row->text_hash);
        $this->assertNull($row->last_error);
        $this->assertNotNull($row->indexed_at);
        $this->assertSame(1, $row->attempts); // one provider attempt burned

        $point = $store->points[(int) $recipe->id] ?? null;
        $this->assertNotNull($point);
        $this->assertSame(FakeEmbeddingProvider::DIMENSIONS, count($point['vector']));
        $payload = $point['payload'];
        $this->assertSame((int) $recipe->id, $payload['recipe_id']);
        $this->assertSame('spaghetti carbonara', $payload['canonical_dish']);
        $this->assertSame('pasta', $payload['dish_family']);
        $this->assertSame('italian', $payload['cuisine']);
        $this->assertSame('Pasta', $payload['category']);
        $this->assertSame('spaghetti', $payload['form']);
        $this->assertSame('Spaghetti Carbonara', $payload['title']);
        $this->assertNull($payload['fingerprint']);
        $this->assertSame(1, $payload['text_version']);
        $this->assertSame('fake-embeddings-v1', $payload['model']);
        $this->assertSame('spaghetti carbonara', $payload['identity']['canonical_dish']); // round-trips
    }

    public function test_fingerprint_is_recorded_in_the_vector_payload(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $fingerprint = RecipeFingerprint::create([
            'recipe_id' => $recipe->id,
            'fingerprint' => 'fp-1',
            'identity_signature' => 'sig-1',
            'ingredient_combo_hash' => 'combo-1',
            'main_ingredient_hash' => 'main-1',
            'title_signature' => 'title-1',
        ]);

        $store = new FakeVectorStore;
        $service = new EmbeddingService(new FakeEmbeddingProvider, $store);
        $service->ensureIndexedGivenIdentity($recipe, $this->identity(), $fingerprint);

        $this->assertSame('fp-1', $store->points[(int) $recipe->id]['payload']['fingerprint']);
    }

    public function test_second_call_with_the_same_identity_is_skipped_without_provider_or_store_calls(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $provider = new FakeEmbeddingProvider;
        $store = new FakeVectorStore;
        $service = new EmbeddingService($provider, $store);
        $identity = $this->identity();

        $this->assertSame('indexed', $service->ensureIndexedGivenIdentity($recipe, $identity, null));
        $this->assertSame(1, $provider->batches); // sanity: first call

        $this->assertSame('skipped', $service->ensureIndexedGivenIdentity($recipe, $identity, null));

        $this->assertSame(1, $provider->batches); // CRITICAL: no provider call
        $this->assertCount(1, $store->points); // no second upsert
        $row = $service->status($recipe);
        $this->assertSame(1, $row->attempts); // not bumped by the skip
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $row->status);
    }

    public function test_identity_drift_reembeds_and_updates_hash_and_vector(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $provider = new FakeEmbeddingProvider;
        $store = new FakeVectorStore;
        $service = new EmbeddingService($provider, $store);

        $this->assertSame('indexed', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));
        $hashBefore = $service->status($recipe)->text_hash;

        $drifted = $this->identity(['canonicalDish' => 'chicken alfredo', 'form' => 'fettuccine']);
        $this->assertSame('indexed', $service->ensureIndexedGivenIdentity($recipe, $drifted, null));

        $row = $service->status($recipe)->fresh();
        $this->assertNotSame($hashBefore, $row->text_hash);
        $this->assertSame(2, $provider->batches); // actually re-embedded
        $this->assertSame('chicken alfredo', $store->points[(int) $recipe->id]['payload']['canonical_dish']);
        $this->assertSame(2, $row->attempts);
    }

    public function test_null_identity_fails_with_identity_unavailable_and_writes_no_vector(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $store = new FakeVectorStore;
        $service = new EmbeddingService(new FakeEmbeddingProvider, $store);

        $this->assertSame('failed', $service->ensureIndexedGivenIdentity($recipe, null, null));

        $row = $service->status($recipe)->fresh();
        $this->assertSame(RecipeEmbedding::STATUS_FAILED, $row->status);
        $this->assertSame('identity_unavailable', $row->last_error);
        $this->assertSame(0, $row->attempts); // no provider attempt burned
        $this->assertSame([], $store->points); // vector store untouched
    }

    public function test_metadata_skeleton_recipe_fails_as_identity_unavailable(): void
    {
        // The foundation-test creation pattern without identity-worthy
        // content (title may not be NULL in SQL — whitespace-only counts
        // as empty for the engine).
        $recipe = Recipe::create(['title' => ' ', 'steps_count' => 0]);
        $store = new FakeVectorStore;
        $service = new EmbeddingService(new FakeEmbeddingProvider, $store);

        $this->assertSame('failed', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));

        $this->assertSame('identity_unavailable', $service->status($recipe)->last_error);
        $this->assertSame([], $store->points);
    }

    public function test_provider_failure_records_failed_status_and_increments_attempts(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $store = new FakeVectorStore;
        $throwing = new class implements EmbeddingProvider
        {
            public int $calls = 0;

            public function key(): string
            {
                return 'throwing';
            }

            public function model(): string
            {
                return 'throwing-model';
            }

            public function embed(array $texts): EmbeddingResult
            {
                $this->calls++;

                throw new EmbeddingException('provider exploded');
            }
        };

        $service = new EmbeddingService($throwing, $store);
        $this->assertSame('failed', $service->ensureIndexedGivenIdentity($recipe->id, $this->identity(), null));

        $row = $service->status($recipe->id)->fresh();
        $this->assertSame(RecipeEmbedding::STATUS_FAILED, $row->status);
        $this->assertSame('provider exploded', $row->last_error);
        $this->assertSame(1, $row->attempts);
        $this->assertSame(1, $throwing->calls);
        $this->assertSame([], $store->points); // no vector write
    }

    public function test_failed_recipe_is_retried_on_next_call(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $throwing = new class implements EmbeddingProvider
        {
            public bool $throw = true;

            public function key(): string
            {
                return 'flaky';
            }

            public function model(): string
            {
                return 'flaky-model';
            }

            public function embed(array $texts): EmbeddingResult
            {
                if ($this->throw) {
                    throw new EmbeddingException('transient');
                }

                return new EmbeddingResult(
                    vectors: array_map(fn (string $text): array => FakeEmbeddingProvider::vectorize($text), $texts),
                    model: $this->model(),
                    dimensions: FakeEmbeddingProvider::DIMENSIONS,
                );
            }
        };

        $store = new FakeVectorStore;
        $service = new EmbeddingService($throwing, $store);

        $this->assertSame('failed', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));

        $throwing->throw = false;
        $this->assertSame('indexed', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));

        $row = $service->status($recipe)->fresh();
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $row->status);
        $this->assertNull($row->last_error);
        $this->assertSame(2, $row->attempts); // both provider rounds recorded
    }

    public function test_batch_indexes_pending_rows_and_fails_identityless_ones(): void
    {
        $a = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $b = Recipe::create(['title' => 'Chicken Alfredo', 'steps_count' => 5]);
        $c = Recipe::create(['title' => 'No identity anywhere']);

        $provider = new FakeEmbeddingProvider;
        $store = new FakeVectorStore;
        $service = new EmbeddingService($provider, $store);

        $statuses = $service->ensureIndexedBatch([
            ['recipe_id' => $a->id, 'identity' => $this->identity(), 'fingerprint' => null],
            ['recipe_id' => $b->id, 'identity' => $this->identity(['canonicalDish' => 'chicken alfredo']), 'fingerprint' => null],
            ['recipe_id' => $c->id, 'identity' => null, 'fingerprint' => null],
        ]);

        $this->assertSame('indexed', $statuses[$a->id]);
        $this->assertSame('indexed', $statuses[$b->id]);
        $this->assertSame('failed', $statuses[$c->id]);
        $this->assertSame('identity_unavailable', $service->status($c)->last_error);

        // Default batch_size (64) fits both pending texts → ONE chunk, ONE
        // provider call for the two texts that need embedding.
        $this->assertSame(1, $provider->batches);
        $this->assertCount(2, $store->points);
    }

    public function test_batch_size_chunks_the_provider_calls_one_call_per_chunk(): void
    {
        $a = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $b = Recipe::create(['title' => 'Chicken Alfredo', 'steps_count' => 5]);
        config(['recipe_dedup.embeddings.batch_size' => 1]);

        $provider = new FakeEmbeddingProvider;
        $service = new EmbeddingService($provider, new FakeVectorStore);

        $statuses = $service->ensureIndexedBatch([
            ['recipe_id' => $a->id, 'identity' => $this->identity(), 'fingerprint' => null],
            ['recipe_id' => $b->id, 'identity' => $this->identity(['canonicalDish' => 'chicken alfredo']), 'fingerprint' => null],
        ]);

        $this->assertSame(['indexed', 'indexed'], [$statuses[$a->id], $statuses[$b->id]]);
        $this->assertSame(2, $provider->batches); // 2 pending rows / chunk size 1
    }

    public function test_batch_provider_failure_fails_exactly_that_chunk(): void
    {
        $a = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $b = Recipe::create(['title' => 'Chicken Alfredo', 'steps_count' => 5]);
        config(['recipe_dedup.embeddings.batch_size' => 1]);

        $throwing = new class implements EmbeddingProvider
        {
            public function key(): string
            {
                return 'throwing';
            }

            public function model(): string
            {
                return 'throwing-model';
            }

            public function embed(array $texts): EmbeddingResult
            {
                throw new EmbeddingException('provider exploded');
            }
        };

        $service = new EmbeddingService($throwing, new FakeVectorStore);
        $statuses = $service->ensureIndexedBatch([
            ['recipe_id' => $a->id, 'identity' => $this->identity(), 'fingerprint' => null],
            ['recipe_id' => $b->id, 'identity' => $this->identity(['canonicalDish' => 'chicken alfredo']), 'fingerprint' => null],
        ]);

        $this->assertSame(['failed', 'failed'], [$statuses[$a->id], $statuses[$b->id]]);
        $this->assertSame('provider exploded', $service->status($a)->last_error);
    }

    public function test_remove_deletes_the_vector_point_and_the_status_row(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $store = new FakeVectorStore;
        $service = new EmbeddingService(new FakeEmbeddingProvider, $store);
        $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null);
        $this->assertCount(1, $store->points);

        $service->remove($recipe);

        $this->assertSame([], $store->points); // point gone
        $this->assertNull($service->status($recipe)); // row deleted
        $this->assertSame(0, RecipeEmbedding::query()->count());
    }

    public function test_embeddings_disabled_config_yields_quiet_skips(): void
    {
        config(['recipe_dedup.embeddings.enabled' => false]);
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $provider = new FakeEmbeddingProvider;
        $store = new FakeVectorStore;
        $service = new EmbeddingService($provider, $store);

        $this->assertSame('skipped', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));
        $this->assertNull($service->status($recipe)); // no row upsert

        $this->assertSame(['skipped'], array_values($service->ensureIndexedBatch([
            ['recipe_id' => $recipe->id, 'identity' => $this->identity(), 'fingerprint' => null],
        ])));
        $this->assertSame(0, $provider->batches);
        $this->assertSame([], $store->points);
    }

    public function test_none_vector_store_yields_quiet_skips(): void
    {
        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $provider = new FakeEmbeddingProvider;
        $service = new EmbeddingService($provider, new NullVectorStore);

        $this->assertSame('skipped', $service->ensureIndexedGivenIdentity($recipe, $this->identity(), null));
        $this->assertNull($service->status($recipe));
        $this->assertSame(0, $provider->batches);
    }

    public function test_service_resolves_from_the_container_with_swapped_fakes(): void
    {
        $store = new FakeVectorStore;
        $this->swap(EmbeddingProvider::class, new FakeEmbeddingProvider);
        $this->swap(VectorStore::class, $store);

        $recipe = Recipe::create(['title' => 'Spaghetti Carbonara', 'steps_count' => 6]);
        $service = app(EmbeddingService::class);

        $this->assertSame('indexed', $service->ensureIndexedGivenIdentity($recipe->id, $this->identity(), null));
        $this->assertArrayHasKey((int) $recipe->id, $store->points);
    }

    public function test_status_of_unknown_recipe_is_null(): void
    {
        $service = new EmbeddingService(new FakeEmbeddingProvider, new FakeVectorStore);

        $this->assertNull($service->status(999999));
    }

    /**
     * The shared carbonara identity fixture.
     *
     * @param  array<string, mixed>  $overrides  keyed by CulinaryIdentity constructor param
     */
    private function identity(array $overrides = []): CulinaryIdentity
    {
        return new CulinaryIdentity(...array_merge([
            'canonicalDish' => 'spaghetti carbonara',
            'dishFamily' => 'pasta',
            'cuisine' => 'italian',
            'category' => 'Pasta',
            'form' => 'spaghetti',
            'mainIngredients' => [
                ['item' => 'spaghetti', 'qty' => 400.0, 'unit' => 'gram', 'raw' => '400 g spaghetti'],
                ['item' => 'guanciale', 'qty' => 150.0, 'unit' => 'gram', 'raw' => '150 g guanciale'],
                ['item' => 'egg', 'qty' => 4.0, 'unit' => 'count', 'raw' => '4 egg yolks'],
            ],
            'supportingIngredients' => [
                ['item' => 'pecorino cheese', 'qty' => 100.0, 'unit' => 'gram', 'raw' => '100 g Pecorino'],
                ['item' => 'black pepper', 'qty' => 2.0, 'unit' => null, 'raw' => '2 tsp black pepper'],
            ],
            'techniques' => ['boil', 'emulsify', 'saute'],
            'cookingMethod' => 'saute',
            'prepMethod' => null,
            'sauces' => [],
            'flavorMarkers' => [],
            'characteristics' => [],
        ], $overrides));
    }
}
