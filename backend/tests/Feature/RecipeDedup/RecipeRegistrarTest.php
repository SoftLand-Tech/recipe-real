<?php

namespace Tests\Feature\RecipeDedup;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeEmbedding;
use App\Models\RecipeFingerprint;
use App\Models\RecipeGenerationBatch;
use App\Models\RecipeStep;
use App\Models\User;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\Detection\CandidateRetriever;
use App\Services\RecipeDedup\Detection\DuplicateDetectionService;
use App\Services\RecipeDedup\Detection\RecipeRegistrar;
use App\Services\RecipeDedup\Detection\SimilarityScorer;
use App\Services\RecipeDedup\EmbeddingException;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\FakeAiDuplicateJudge;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

/**
 * RecipeRegistrar contract: accepted candidates persist recipe + steps +
 * fingerprint + embedding INSIDE one transaction (with the fingerprint
 * UNIQUE guard as the race catch), duplicates / reviews insert nothing,
 * batch context stamps source_type + batch_id on the check rows, and the
 * post-commit embedding hook stays fail-soft.
 */
final class RecipeRegistrarTest extends TestCase
{
    use RefreshDatabase;

    private FingerprintService $fingerprints;

    private FakeEmbeddingProvider $provider;

    private FakeVectorStore $store;

    private FakeAiDuplicateJudge $judge;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fingerprints = new FingerprintService;
        $this->provider = new FakeEmbeddingProvider;
        $this->store = new FakeVectorStore;
        $this->judge = new FakeAiDuplicateJudge;
    }

    private function registrarUnderTest(?DuplicateDetectionService $service = null, ?EmbeddingService $embeddings = null): RecipeRegistrar
    {
        return new RecipeRegistrar(
            $service ?? $this->detectionService(),
            $this->fingerprints,
            $embeddings ?? new EmbeddingService($this->provider, $this->store),
        );
    }

    private function detectionService(?EmbeddingService $embeddings = null): DuplicateDetectionService
    {
        return new DuplicateDetectionService(
            $this->fingerprints,
            new CandidateRetriever(
                $this->fingerprints,
                $this->provider,
                $this->store,
            ),
            new SimilarityScorer,
            $this->judge,
            $this->provider,
        );
    }

    private function candidate(): CandidateRecipe
    {
        return CandidateRecipe::fromDraft(RecipeFixtures::carbonaraRaw());
    }

    public function test_accepted_registration_persists_recipe_steps_fingerprint_embedding_and_check(): void
    {
        $owner = User::factory()->create();
        $result = $this->registrarUnderTest()->register($this->candidate(), null, (int) $owner->id);

        $this->assertTrue($result->accepted());
        $recipe = $result->recipe;
        $this->assertNotNull($recipe);
        $this->assertSame('Spaghetti Carbonara', $recipe->title);
        $this->assertSame('user', $recipe->source_type); // no batch -> community recipe
        $this->assertSame((int) $owner->id, (int) $recipe->owner_id);

        // Steps: one row per description, 1-based numbers, plain active.
        $steps = RecipeStep::query()->where('recipe_id', $recipe->id)->orderBy('step_number')->get();
        $this->assertSame(6, $steps->count());
        $this->assertSame([1, 2, 3, 4, 5, 6], $steps->pluck('step_number')->all());
        $this->assertSame('active', $steps->first()->step_type);
        $this->assertNotSame('', trim((string) $steps->first()->description));

        // Fingerprint row: the dedup evidence + DB UNIQUE guard.
        $fingerprintRow = $this->fingerprints->forRecipe((int) $recipe->id);
        $this->assertNotNull($fingerprintRow);
        $this->assertTrue($fingerprintRow->is_complete);
        $this->assertNotSame('', $fingerprintRow->fingerprint);
        $this->assertNotNull($fingerprintRow->identity); // identity payload embedded

        // Post-commit indexing wrote the embedding row AND the vector point.
        $embedding = RecipeEmbedding::query()->where('recipe_id', $recipe->id)->first();
        $this->assertNotNull($embedding);
        $this->assertSame(RecipeEmbedding::STATUS_INDEXED, $embedding->status);
        $this->assertSame('fake-embeddings-v1', $embedding->model);
        $this->assertArrayHasKey((int) $recipe->id, $this->store->points);

        // The accepted decision is audited with its structural scores.
        $check = DuplicateCheck::query()->where('source', 'auto_review')->latest('id')->first();
        $this->assertNotNull($check);
        $this->assertSame((int) $recipe->id, (int) $check->recipe_id);
        $this->assertSame(DuplicateCheck::ACTION_ACCEPTED, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $check->status);
        $this->assertFalse((bool) $check->is_duplicate);
        $this->assertSame(2, $check->layer); // accepted in layer 2 (nothing comparable yet)
        $this->assertNull($check->batch_id);
    }

    public function test_duplicate_registration_inserts_nothing(): void
    {
        $registrar = $this->registrarUnderTest();

        $first = $registrar->register($this->candidate());
        $this->assertTrue($first->accepted());

        $second = $registrar->register($this->candidate());

        $this->assertFalse($second->accepted());
        $this->assertNull($second->recipe);
        $this->assertTrue($second->decision->isDuplicate);

        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame(6, RecipeStep::query()->count());
        $this->assertSame(1, RecipeFingerprint::query()->count());
        $this->assertSame(1, RecipeEmbedding::query()->count());

        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $this->latestCheck()->action);
    }

    public function test_needs_review_registration_does_not_insert(): void
    {
        $registrar = $this->registrarUnderTest();

        // Force the review path: a degraded fingerprint row matching the
        // candidate exactly (the never-auto-reject contract).
        [, $row] = $this->registerCandidate($this->candidate());
        RecipeFingerprint::query()->whereKey($row->id)->update(['is_complete' => false]);

        $result = $registrar->register($this->candidate());

        $this->assertFalse($result->accepted());
        $this->assertNull($result->recipe);
        $this->assertSame('needs_review', $result->decision->action);

        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $this->latestCheck()->action);
        $this->assertNull($this->latestCheck()->is_duplicate);
        $this->assertSame(DuplicateCheck::STATUS_NEEDS_REVIEW, $this->latestCheck()->status);
    }

    /**
     * The fingerprint-collision race inside an EXISTING transaction: the
     * INSERT hits the UNIQUE(fingerprint) guard, the savepoint rollbs back
     * the recipe + steps silently, and the registrar returns a duplicate
     * decision of the winning row — no exception escapes, no orphan rows.
     */
    public function test_collision_inside_a_running_transaction_rolls_back_cleanly(): void
    {
        $holder = Recipe::create(['title' => 'Tomato Basil Pasta', 'steps_count' => 1]);

        $candidate = CandidateRecipe::fromDraft(RecipeFixtures::carbonaraRaw());
        $set = $this->fingerprints->fingerprintSet($candidate);
        $identity = $this->fingerprints->identity($candidate);

        RecipeFingerprint::query()->create([
            'recipe_id' => (int) $holder->id,
            'version' => 1,
            'fingerprint' => $set->fingerprint,
            'identity_signature' => $set->identitySignature,
            'ingredient_combo_hash' => $set->ingredientComboHash,
            'main_ingredient_hash' => $set->mainIngredientHash,
            'title_signature' => $set->titleSignature,
            'identity' => $identity->toArray(),
            'is_complete' => true,
        ]);

        $captured = [];

        DB::transaction(function () use (&$captured, $holder): void {
            // The racing candidate excludes the holder's row during
            // evaluate (it rides meta['recipe_id']) so evaluate misses and
            // the INSERT collides — the race window, deterministically.
            $racing = CandidateRecipe::fromDraft([
                ...RecipeFixtures::carbonaraRaw(),
                'meta' => ['recipe_id' => (int) $holder->id],
            ]);

            $result = $this->registrarUnderTest()->register($racing);
            $captured['result'] = $result;

            // Still inside the outer transaction: the raced insert is gone.
            $captured['recipes_inside'] = Recipe::query()->count();
        });

        $result = $captured['result'];
        $this->assertFalse($result->accepted());
        $this->assertNull($result->recipe);
        $this->assertTrue($result->decision->isDuplicate);
        $this->assertSame((int) $holder->id, $result->decision->matchedRecipeId);
        $this->assertSame(1, $captured['recipes_inside']); // only the holder

        // Committed state stayed clean too: no orphan candidate recipe.
        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame(0, RecipeStep::query()->count());

        $collision = $this->latestCheck();
        $this->assertSame(1, $collision->layer);
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $collision->action);
        $this->assertSame('fingerprint collision on insert', $collision->reason);
        $this->assertSame((int) $holder->id, (int) $collision->matched_recipe_id);
        $this->assertNull($collision->recipe_id);
        $this->assertNull($collision->batch_id);
    }

    public function test_generation_batch_sets_source_type_and_stamps_the_check_row(): void
    {
        $batch = RecipeGenerationBatch::create([
            'requested_count' => 5,
            'max_attempts' => 15,
            'status' => RecipeGenerationBatch::STATUS_RUNNING,
            'params' => ['cuisine' => 'italian'],
        ]);

        $owner = User::factory()->create();
        $result = $this->registrarUnderTest()->register($this->candidate(), $batch, (int) $owner->id);

        $this->assertTrue($result->accepted());
        $recipe = $result->recipe;
        $this->assertNotNull($recipe);
        $this->assertSame('ai_batch', $recipe->source_type); // config generation.source_type
        $this->assertSame((int) $owner->id, (int) $recipe->owner_id);

        $check = DuplicateCheck::query()->findOrFail((int) $result->decision->checkId);
        $this->assertSame(DuplicateCheck::SOURCE_GENERATION, $check->source);
        $this->assertSame((int) $batch->id, (int) $check->batch_id);
        $this->assertSame((int) $recipe->id, (int) $check->recipe_id);
    }

    public function test_terminal_batch_refuses_registration(): void
    {
        $batch = RecipeGenerationBatch::create([
            'requested_count' => 5,
            'max_attempts' => 15,
            'status' => RecipeGenerationBatch::STATUS_COMPLETED,
            'params' => [],
        ]);

        $this->expectException(GenerationException::class);

        try {
            $this->registrarUnderTest()->register($this->candidate(), $batch);
        } finally {
            $this->assertSame(0, Recipe::query()->count());
        }
    }

    public function test_registration_survives_a_dead_embedder(): void
    {
        $dead = new EmbeddingService(
            new class implements EmbeddingProvider
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
                    throw new EmbeddingException('embedding endpoint unreachable');
                }
            },
            $this->store,
        );

        $result = $this->registrarUnderTest(null, $dead)->register($this->candidate());

        // The committed registration is untouched; only indexing fell soft.
        $this->assertTrue($result->accepted());
        $this->assertNotNull($result->recipe);
        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame(6, RecipeStep::query()->count());

        // With a dead embedder there is no indexed point, and the decision
        // audit row still exists.
        $this->assertSame(DuplicateCheck::ACTION_ACCEPTED, $this->latestCheck()->action);
    }

    private function latestCheck(): DuplicateCheck
    {
        $check = DuplicateCheck::query()->latest('id')->first();
        $this->assertNotNull($check, 'expected a duplicate_checks row');

        return $check;
    }

    private function registerCandidate(CandidateRecipe $candidate): array
    {
        $recipe = Recipe::create([
            'title' => $candidate->title !== '' ? $candidate->title : 'Untitled',
            'ingredients' => $candidate->ingredientsRaw,
            'steps' => $candidate->steps,
            'keywords' => $candidate->keywords,
            'category' => $candidate->category ?? 'Dinner',
            'steps_count' => count($candidate->steps),
        ]);

        $row = $this->fingerprints->register($recipe, $candidate);

        return [$recipe, $row];
    }
}
