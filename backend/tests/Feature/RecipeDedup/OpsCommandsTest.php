<?php

namespace Tests\Feature\RecipeDedup;

use App\Jobs\BackfillRecipesChunk;
use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Models\User;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\VectorStoreException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class OpsCommandsTest extends TestCase
{
    use RefreshDatabase;

    private FakeEmbeddingProvider $provider;

    private FakeVectorStore $store;

    protected function setUp(): void
    {
        parent::setUp();

        $this->provider = new FakeEmbeddingProvider;
        $this->store = new FakeVectorStore;
        $this->swap(EmbeddingProvider::class, $this->provider);
        $this->swap(VectorStore::class, $this->store);

        config([
            'recipe_dedup.enabled' => true,
            'recipe_dedup.embeddings.enabled' => true,
            'recipe_dedup.indexing.embed_immediately' => true,
        ]);
    }

    /** --sync walks the whole table; a second run is a no-op. */
    public function test_dedup_index_sync_fingerprints_all_and_repeats_safely(): void
    {
        foreach (range(1, 5) as $index) {
            $this->createFixtureRecipe('carbonaraRaw', "Index sync row #{$index}");
        }

        $this->artisan('recipereal:dedup-index', ['--sync' => true])->assertSuccessful();

        $this->assertSame(5, RecipeFingerprint::query()->count());
        $this->assertSame(5, RecipeEmbedding::query()->where('status', RecipeEmbedding::STATUS_INDEXED)->count());
        $this->assertTrue((bool) Cache::get(BackfillRecipesChunk::DONE_KEY));
        $batchesAfterFirstRun = $this->provider->batches;
        $signatures = RecipeFingerprint::query()->orderBy('recipe_id')->pluck('identity_signature')->all();

        // Second --sync run: everything already indexed → nothing re-embedded.
        $this->artisan('recipereal:dedup-index', ['--sync' => true])->assertSuccessful();

        $this->assertSame($batchesAfterFirstRun, $this->provider->batches);
        $this->assertSame(5, RecipeFingerprint::query()->count());
        $this->assertSame($signatures, RecipeFingerprint::query()->orderBy('recipe_id')->pluck('identity_signature')->all());
        $this->assertSame(
            5,
            RecipeEmbedding::query()->where('attempts', 1)->count(), // never re-attempted
        );
    }

    public function test_dedup_index_refuses_to_run_when_the_engine_is_disabled(): void
    {
        config(['recipe_dedup.enabled' => false]);

        $this->artisan('recipereal:dedup-index', ['--sync' => true])->assertExitCode(1);
        $this->artisan('recipereal:dedup-index')->assertExitCode(1);
    }

    public function test_dedup_status_prints_aggregate_counts_and_ping(): void
    {
        $registered = $this->createFixtureRecipe('carbonaraRaw', 'Status carbonara');
        $this->indexRecipe($registered);
        config(['recipe_dedup.vector.driver' => 'qdrant']);

        $this->artisan('recipereal:dedup-status')
            ->assertSuccessful()
            ->expectsOutputToContain('indexed')
            ->expectsOutputToContain('reachable');

        $this->artisan('recipereal:dedup-status')->expectsOutputToContain('ping');
    }

    public function test_dedup_reindex_recipe_extracts_a_new_fingerprint_after_an_edit(): void
    {
        $recipe = $this->createFixtureRecipe('carbonaraRaw', 'Reindex me');
        app(FingerprintService::class)->register($recipe);
        $before = RecipeFingerprint::query()->where('recipe_id', $recipe->id)->value('fingerprint');

        $recipe->forceFill([
            'ingredients' => ['1 kg spaghetti', '300 g bacon', '6 eggs'],
            'steps' => ['Boil the pasta.', 'Fry the bacon and eggs.'],
            'steps_count' => 2,
        ])->save();

        $this->artisan('recipereal:dedup-reindex-recipe', ['recipe_id' => $recipe->id])->assertSuccessful();

        $after = RecipeFingerprint::query()->where('recipe_id', $recipe->id)->value('fingerprint');
        $this->assertNotSame($before, $after);
        $this->assertSame(RecipeFingerprint::query()->where('recipe_id', $recipe->id)->count(), 1); // updateOrCreate, not a second row
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, (string) RecipeEmbedding::query()->where('recipe_id', $recipe->id)->value('status'));

        $this->artisan('recipereal:dedup-reindex-recipe', ['recipe_id' => 424242])->assertExitCode(1);
    }

    public function test_dedup_rebuild_embeddings_confirms_then_dispatches_the_rebuild(): void
    {
        foreach (range(1, 3) as $index) {
            $recipe = $this->createFixtureRecipe('carbonaraRaw', "Rebuild row #{$index}");
            $this->indexRecipe($recipe);
        }

        Queue::fake();

        // Without --force the confirmation defaults to NO: nothing happens.
        $this->artisan('recipereal:dedup-rebuild-embeddings')
            ->expectsConfirmation('Proceed with the embeddings rebuild?', 'no')
            ->assertSuccessful();
        $this->assertSame(3, RecipeEmbedding::query()->count());
        Queue::assertNothingPushed();

        // --force: wipe + dispatch the rebuild walk from recipe #1.
        $this->artisan('recipereal:dedup-rebuild-embeddings', ['--force' => true])->assertSuccessful();

        $this->assertSame(0, RecipeEmbedding::query()->count());
        $this->assertTrue((bool) Cache::get(BackfillRecipesChunk::REBUILD_PENDING_KEY));
        Queue::assertPushed(BackfillRecipesChunk::class, 1);
        Queue::assertPushed(BackfillRecipesChunk::class, fn (BackfillRecipesChunk $job): bool => $job->startId === 1);

        // Fingerprints + pairs are untouched by the rebuild.
        $this->assertSame(3, RecipeFingerprint::query()->count());
    }

    public function test_dedup_check_vector_reports_reachable_and_failing_stores(): void
    {
        $this->store->healthy = true;
        $this->artisan('recipereal:dedup-check-vector')
            ->assertSuccessful()
            ->expectsOutputToContain('reachable');

        $this->store->healthy = false;
        $this->artisan('recipereal:dedup-check-vector')->assertExitCode(1);

        $this->swap(VectorStore::class, new class implements VectorStore
        {
            public function enabled(): bool
            {
                return true;
            }

            public function collection(): string
            {
                return 'recipe_embeddings';
            }

            public function ensureCollection(int $dimensions): void {}

            public function upsertMany(array $points): void {}

            public function search(array $vector, int $limit, array $filters = []): array
            {
                return [];
            }

            public function delete(int $recipeId): void {}

            public function ping(): bool
            {
                throw new VectorStoreException('connection refused');
            }
        });

        $this->artisan('recipereal:dedup-check-vector')
            ->assertExitCode(1)
            ->expectsOutputToContain('UNREACHABLE');
    }

    public function test_dedup_scan_flags_one_pair_per_cluster_and_is_idempotent(): void
    {
        $older = $this->createFixtureRecipe('carbonaraRaw', 'Scan carbonara');

        // Same culinary identity, but the pecorino quantity lands in another
        // bin → different FULL fingerprint, identical identity_signature.
        $draft = RecipeFixtures::carbonaraRaw();
        $draft['ingredients'] = array_map(
            fn (string $line): string => str_starts_with($line, '100 g Pecorino')
                ? '150 g Pecorino Romano, finely grated'
                : $line,
            $draft['ingredients'],
        );
        $younger = Recipe::create([
            'title' => 'Scan carbonara',
            'description' => $draft['description'],
            'ingredients' => $draft['ingredients'],
            'steps' => $draft['steps'],
            'keywords' => $draft['keywords'],
            'category' => (string) ($draft['category'] ?? 'Dinner'),
            'steps_count' => count($draft['steps']),
        ]);

        $distinct = $this->createFixtureRecipe('chickenAlfredoClassic', 'Scan alfredo');

        $service = app(FingerprintService::class);
        $service->register($older);
        $service->register($younger);
        $service->register($distinct);

        $olderSignature = RecipeFingerprint::query()->where('recipe_id', $older->id)->value('identity_signature');
        $youngerSignature = RecipeFingerprint::query()->where('recipe_id', $younger->id)->value('identity_signature');
        $this->assertSame($olderSignature, $youngerSignature); // cluster precondition
        $this->assertNotSame(
            RecipeFingerprint::query()->where('recipe_id', $older->id)->value('fingerprint'),
            RecipeFingerprint::query()->where('recipe_id', $younger->id)->value('fingerprint'),
        ); // but NOT an exact collision

        $this->artisan('recipereal:dedup-scan', ['--chunk' => 2])->assertSuccessful();

        $this->assertDatabaseHas('recipe_duplicate_pairs', [
            'recipe_id' => $younger->id, // youngest of the cluster
            'duplicate_of_recipe_id' => $older->id, // oldest = stable anchor
            'source' => 'engine',
            'status' => RecipeDuplicatePair::STATUS_FLAGGED,
        ]);
        $this->assertSame(1, RecipeDuplicatePair::query()->count());
        $this->assertFalse(RecipeDuplicatePair::query()->where(function ($query) use ($distinct): void {
            $query->where('recipe_id', $distinct->id)->orWhere('duplicate_of_recipe_id', $distinct->id);
        })->exists());

        // Idempotent re-run: UNIQUE (recipe_id, duplicate_of_recipe_id) holds.
        $this->artisan('recipereal:dedup-scan', ['--field' => 'identity_signature'])->assertSuccessful();
        $this->assertSame(1, RecipeDuplicatePair::query()->count());
    }

    public function test_dedup_review_records_an_append_only_manual_decision(): void
    {
        $older = $this->createFixtureRecipe('carbonaraRaw', 'Review carbonara A');
        $younger = $this->createFixtureRecipe('carbonaraRaw', 'Review carbonara B');
        $this->createFixtureRecipe('chickenAlfredoClassic', 'Review alfredo');

        $check = DuplicateCheck::create([
            'recipe_id' => $younger->id,
            'matched_recipe_id' => $older->id,
            'source' => DuplicateCheck::SOURCE_BACKFILL,
            'layer' => 1,
            'action' => DuplicateCheck::ACTION_FLAGGED_REVIEW,
            'is_duplicate' => null,
            'reason' => 'exact fingerprint collision during backfill; pair recorded',
            'status' => DuplicateCheck::STATUS_NEEDS_REVIEW,
        ]);

        $reviewer = User::factory()->create(['email' => 'ops@example.test']);

        $this->artisan('recipereal:dedup-review', [
            'check_id' => $check->id,
            'verdict' => 'duplicate',
            '--user-email' => $reviewer->email,
        ])->assertSuccessful()->expectsOutputToContain((string) $check->id);

        // The operative pair is created and attributed.
        $pair = RecipeDuplicatePair::query()->where('recipe_id', $younger->id)
            ->where('duplicate_of_recipe_id', $older->id)->firstOrFail();
        $this->assertSame(RecipeDuplicatePair::STATUS_CONFIRMED_DUPLICATE, $pair->status);
        $this->assertSame('manual', $pair->source);
        $this->assertSame($reviewer->id, (int) $pair->decided_by);
        $this->assertSame($check->id, (int) $pair->check_id);
        $this->assertNotNull($pair->decided_at);

        // Append-only history: NEW manual check row + resolved original.
        $this->assertDatabaseHas('duplicate_checks', [
            'recipe_id' => $younger->id,
            'matched_recipe_id' => $older->id,
            'source' => DuplicateCheck::SOURCE_MANUAL,
            'action' => DuplicateCheck::ACTION_REJECTED_DUPLICATE,
            'is_duplicate' => true,
            'status' => DuplicateCheck::STATUS_RESOLVED,
        ]);

        $original = $check->fresh();
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $original->status);
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $original->action); // original data intact
        $this->assertSame(DuplicateCheck::SOURCE_BACKFILL, $original->source);
        $this->assertSame(1, $original->layer);

        // A resolved check can not be reviewed twice.
        $this->artisan('recipereal:dedup-review', [
            'check_id' => $check->id,
            'verdict' => 'distinct',
        ])->assertExitCode(1);
        $this->assertSame(2, DuplicateCheck::query()->count());
        $this->assertSame(1, RecipeDuplicatePair::query()->count());
    }

    public function test_dedup_review_validates_verdict_and_check_id(): void
    {
        $older = $this->createFixtureRecipe('carbonaraRaw', 'Validation carbonara A');
        $this->createFixtureRecipe('chickenAlfredoClassic', 'Validation alfredo');

        $this->artisan('recipereal:dedup-review', [
            'check_id' => 999999,
            'verdict' => 'duplicate',
        ])->assertExitCode(1);

        $check = DuplicateCheck::create([
            'recipe_id' => $older->id,
            'matched_recipe_id' => null,
            'source' => DuplicateCheck::SOURCE_BACKFILL,
            'layer' => 1,
            'action' => DuplicateCheck::ACTION_FLAGGED_REVIEW,
            'status' => DuplicateCheck::STATUS_NEEDS_REVIEW,
        ]);

        $this->artisan('recipereal:dedup-review', [
            'check_id' => $check->id,
            'verdict' => 'dunno',
        ])->assertExitCode(1);
        $this->assertSame(RecipeDuplicatePair::query()->count(), 0);
    }

    private function createFixtureRecipe(string $fixture, string $title): Recipe
    {
        $draft = RecipeFixtures::{$fixture}();

        return Recipe::create([
            'title' => $title,
            'description' => $draft['description'] ?? null,
            'ingredients' => $draft['ingredients'],
            'steps' => $draft['steps'],
            'keywords' => $draft['keywords'] ?? [],
            'category' => (string) ($draft['category'] ?? 'Dinner'),
            'steps_count' => count($draft['steps']),
        ]);
    }

    /** Real (faked) register + embed chain so the row ends up INDEXED. */
    private function indexRecipe(Recipe $recipe): void
    {
        $fingerprints = app(FingerprintService::class);
        $fingerprint = $fingerprints->register($recipe);

        $status = app(EmbeddingService::class)->ensureIndexedGivenIdentity(
            $recipe,
            $fingerprints->identityOf($recipe),
            $fingerprint,
        );

        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $status);
    }
}
