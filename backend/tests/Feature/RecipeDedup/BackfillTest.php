<?php

namespace Tests\Feature\RecipeDedup;

use App\Jobs\BackfillRecipesChunk;
use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeDuplicatePair;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class BackfillTest extends TestCase
{
    use RefreshDatabase;

    private FakeEmbeddingProvider $provider;

    private FakeVectorStore $store;

    private FingerprintService $fingerprints;

    protected function setUp(): void
    {
        parent::setUp();

        $this->provider = new FakeEmbeddingProvider;
        $this->store = new FakeVectorStore;
        $this->swap(EmbeddingProvider::class, $this->provider);
        $this->swap(VectorStore::class, $this->store);

        $this->fingerprints = app(FingerprintService::class);

        config([
            'recipe_dedup.enabled' => true,
            'recipe_dedup.embeddings.enabled' => true,
            'recipe_dedup.indexing.embed_immediately' => true,
        ]);
    }

    /**
     * 12 recipes, chunk size 5 → connected chunks 1-5, 6-10, 11-12; every
     * row fingerprinted + embedded, cursor lands on the last id, done flag set.
     */
    public function test_backfill_chunks_chain_to_full_coverage(): void
    {
        $recipes = [];
        foreach (range(1, 12) as $index) {
            $recipes[$index] = $this->createFixtureRecipe('carbonaraRaw', "Carbonara row #{$index} (variation {$index})");
        }

        Queue::fake();

        $first = new BackfillRecipesChunk(1, 5);
        app()->call([$first, 'handle']);

        // The first chunk must chain exactly the next one — no ahead-queued jobs.
        Queue::assertPushed(BackfillRecipesChunk::class, 1);
        Queue::assertPushed(BackfillRecipesChunk::class, fn (BackfillRecipesChunk $job): bool => $job->startId === (int) $recipes[6]->id && $job->chunkSize === 5);

        // Walk the chain by hand: 6-10 then 11-12.
        app()->call([(new BackfillRecipesChunk(6, 5)), 'handle']);
        app()->call([(new BackfillRecipesChunk(11, 5)), 'handle']);

        $this->assertSame(12, RecipeFingerprint::query()->count());
        $this->assertSame(12, RecipeEmbedding::query()->where('status', RecipeEmbedding::STATUS_INDEXED)->count());

        $last = $recipes[12];
        $this->assertSame((int) $last->id, (int) Cache::get(BackfillRecipesChunk::CURSOR_KEY));
        $this->assertTrue((bool) Cache::get(BackfillRecipesChunk::DONE_KEY));
        $this->assertNull(Cache::get(BackfillRecipesChunk::RUNNING_KEY));

        // Chained job ids: 6 (leaf 11 dispatches nothing — the walk ended).
        Queue::assertPushed(BackfillRecipesChunk::class, 2);
        Queue::assertPushed(BackfillRecipesChunk::class, fn (BackfillRecipesChunk $job): bool => $job->startId === (int) $recipes[11]->id);

        // Fresh fingerprints are never reprocessed by a re-run window.
        $batchBefore = $this->provider->batches;
        app()->call([(new BackfillRecipesChunk(1, 200)), 'handle']);
        $this->assertSame($batchBefore, $this->provider->batches);
    }

    /** Crash mid-way: the saved cursor drives resume without re-embedding. */
    public function test_resume_from_cursor_does_not_re_embed_indexed_recipes(): void
    {
        $recipes = [];
        foreach (range(1, 6) as $index) {
            $recipes[$index] = $this->createFixtureRecipe('carbonaraRaw', "Resume row #{$index}");
        }

        $partial = new BackfillRecipesChunk(1, 4);
        $partial->chain = false; // emulate a dead worker: no successor ran
        app()->call([$partial, 'handle']);

        $this->assertSame(4, (int) Cache::get(BackfillRecipesChunk::CURSOR_KEY));
        $this->assertNotTrue((bool) Cache::get(BackfillRecipesChunk::DONE_KEY));
        $batchesForFirstFour = $this->provider->batches;
        $this->assertSame(4, $batchesForFirstFour);
        $attemptsForFirstFour = RecipeEmbedding::query()
            ->whereIn('recipe_id', array_map(fn ($row) => (int) $row->id, array_slice($recipes, 0, 4, true)))
            ->pluck('attempts', 'recipe_id')
            ->all();

        // The guard's fresh-chain signal is exactly what a dead worker
        // leaves behind: explicit --force is the operator's resume
        // override after a crash.
        $this->artisan('recipereal:dedup-index', ['--sync' => true, '--force' => true])->assertSuccessful();

        $this->assertSame(6, RecipeFingerprint::query()->count());
        $this->assertSame(6, RecipeEmbedding::query()->count());
        $this->assertSame(6, (int) Cache::get(BackfillRecipesChunk::CURSOR_KEY));
        $this->assertTrue((bool) Cache::get(BackfillRecipesChunk::DONE_KEY));

        // The already-indexed 1..4 rows were NOT re-embedded or re-counted.
        $this->assertSame($batchesForFirstFour + 2, $this->provider->batches);
        foreach ($attemptsForFirstFour as $recipeId => $attempts) {
            $this->assertSame($attempts, RecipeEmbedding::query()->where('recipe_id', $recipeId)->value('attempts'));
        }
    }

    /** Exact-fingerprint collision: pair + needs_review check, NO vector row. */
    public function test_collision_records_pair_and_check_without_stopping_the_chunk(): void
    {
        $first = $this->createFixtureRecipe('carbonaraRaw', 'Spaghetti Carbonara');
        $this->fingerprints->register($first);

        // Recipe B is entered from the SAME draft — exact collision with A.
        $colliding = $this->createFixtureRecipe('carbonaraRaw', 'Spaghetti Carbonara');

        // Recipe C behind the collision must still be processed.
        $afterwards = $this->createFixtureRecipe('chickenAlfredoClassic', 'Chicken Alfredo Fettuccine');

        $job = new BackfillRecipesChunk(1, 200);
        $job->chain = false;
        $summary = app()->call([$job, 'handle']);

        // The pair: this recipe → holder, engine source, flagged.
        $this->assertDatabaseHas('recipe_duplicate_pairs', [
            'recipe_id' => $colliding->id,
            'duplicate_of_recipe_id' => $first->id,
            'source' => 'engine',
            'status' => RecipeDuplicatePair::STATUS_FLAGGED,
        ]);

        // The append-only check row: backfill source, layer 1, flagged
        // review, undecided.
        $check = DuplicateCheck::query()
            ->where('recipe_id', $colliding->id)
            ->where('matched_recipe_id', $first->id)
            ->where('source', DuplicateCheck::SOURCE_BACKFILL)
            ->firstOrFail();
        $this->assertSame(1, $check->layer);
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_NEEDS_REVIEW, $check->status);
        $this->assertNull($check->is_duplicate);

        // The collided recipe is NEVER embedded or deleted; the chunk continued.
        $this->assertFalse(RecipeEmbedding::query()->where('recipe_id', $colliding->id)->exists());
        $this->assertFalse(RecipeFingerprint::query()->where('recipe_id', $colliding->id)->exists());
        $this->assertSame(1, $summary['collisions']);
        $this->assertNotNull($colliding->fresh());
        $this->assertNotNull($afterwards->fresh());
        $this->assertTrue(RecipeFingerprint::query()->where('recipe_id', $afterwards->id)->exists());
        $this->assertTrue(RecipeEmbedding::query()->where('recipe_id', $afterwards->id)->where('status', RecipeEmbedding::STATUS_INDEXED)->exists());
    }

    /** A failing embedding provider never escapes the job; rows end 'failed'. */
    public function test_failed_embedding_is_recorded_and_the_chunk_completes(): void
    {
        $recipes = [];
        foreach (range(1, 3) as $index) {
            $recipes[$index] = $this->createFixtureRecipe('chickenAlfredoClassic', "Alfredo row #{$index}");
        }

        $this->swap(EmbeddingProvider::class, new class implements EmbeddingProvider
        {
            public function key(): string
            {
                return 'broken';
            }

            public function model(): string
            {
                return 'broken-model';
            }

            public function embed(array $texts): EmbeddingResult
            {
                throw new EmbeddingException('provider exploded');
            }
        });

        $job = new BackfillRecipesChunk(1, 200);
        $job->chain = false;
        $summary = app()->call([$job, 'handle']); // must not throw

        $this->assertSame(3, $summary['embedding_failed']);
        $this->assertSame(0, $summary['failed']);
        $failed = RecipeEmbedding::query()->where('status', RecipeEmbedding::STATUS_FAILED)->count();
        $this->assertSame(3, $failed);
        $this->assertTrue((bool) Cache::get(BackfillRecipesChunk::DONE_KEY));
        // Fingerprints were still extracted + registered before the failure,
        // but the provider blew up before any vector upsert could happen.
        $this->assertSame(3, RecipeFingerprint::query()->count());
        $this->assertSame([], $this->store->points);
    }

    /** Stale fingerprint versions get re-extracted; current ones skipped. */
    public function test_stale_version_is_reprocessed_but_current_version_is_skipped(): void
    {
        $fresh = $this->createFixtureRecipe('carbonaraRaw', 'Fresh version row');
        $this->fingerprints->register($fresh);

        $stale = $this->createFixtureRecipe('chickenAlfredoClassic', 'Stale version row');
        $this->fingerprints->register($stale);
        $staleRow = RecipeFingerprint::query()->where('recipe_id', $stale->id)->firstOrFail();
        $oldStaleSignature = $staleRow->identity_signature;
        $staleRow->forceFill(['version' => CulinaryIdentity::VERSION - 1])->save();

        $job = new BackfillRecipesChunk(1, 200);
        $job->chain = false;
        $summary = app()->call([$job, 'handle']);

        $this->assertSame(1, $summary['skipped']);
        $this->assertSame(1, $summary['registered']); // only the stale one re-processed

        $this->assertSame(CulinaryIdentity::VERSION, (int) RecipeFingerprint::query()->where('recipe_id', $fresh->id)->value('version'));
        $this->assertSame(CulinaryIdentity::VERSION, (int) RecipeFingerprint::query()->where('recipe_id', $stale->id)->value('version'));
        $this->assertSame($oldStaleSignature, RecipeFingerprint::query()->where('recipe_id', $stale->id)->value('identity_signature'));
        // same recipe → same hashes, just re-extracted
    }

    /** Incomplete metadata registers with is_complete=false and no crash. */
    public function test_incomplete_metadata_does_not_crash_and_is_marked_incomplete(): void
    {
        $sparse = Recipe::create([
            'title' => 'Mystery leftovers',
            'steps_count' => 0,
        ]);

        $job = new BackfillRecipesChunk(1, 200);
        $job->chain = false;
        app()->call([$job, 'handle']);

        $row = RecipeFingerprint::query()->where('recipe_id', $sparse->id)->firstOrFail();
        $this->assertFalse($row->is_complete);

        $identity = $this->fingerprints->identityOf($sparse);
        $this->assertNotNull($identity);
        $this->assertSame([], $identity->mainIngredientNames());

        // Never eligible for exact rejection: is_complete=false stays false.
        $this->assertDatabaseHas('recipe_fingerprints', ['recipe_id' => $sparse->id, 'is_complete' => false]);
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
}
