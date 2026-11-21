<?php

namespace Tests\Feature\RecipeDedup;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Models\RecipeGenerationBatch;
use App\Models\RecipeStep;
use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\Detection\CandidateRetriever;
use App\Services\RecipeDedup\Detection\DuplicateDetectionService;
use App\Services\RecipeDedup\Detection\RecipeRegistrar;
use App\Services\RecipeDedup\Detection\SimilarityScorer;
use App\Services\RecipeDedup\EmbeddingException;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\Judge\HttpAiDuplicateJudge;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Support\FakeAiDuplicateJudge;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

/**
 * The 18-scenario calibration core of the duplicate detection engine,
 * each test named after its brief scenario number. Verified against the
 * deterministic FakeEmbeddingProvider / FakeVectorStore / FakeAiDuplicateJudge
 * support fakes. Pinned threshold behavior (documented in the tests):
 *
 *   - carbonaraRaw vs carbonaraAlternate  -> score 0.9237, corroborated  -> LAYER 2 duplicate
 *     (fingerprints DIFFER via qty binning: 400 g vs 450 g spaghetti / 100 g vs 90 g pecorino).
 *   - alfredo classic vs spicy            -> score 0.9225, corroborated  -> LAYER 2 duplicate
 *     (the fake provider's cosine is aggressive vs a real one, where this
 *     pair lands in the judge band; see the report's scoring gotcha).
 *   - baked alfredo variant               -> score 0.7206, corroborated  -> verify band -> LAYER 3
 *     (canonical dish 'baked chicken alfredo casserole' != 'chicken alfredo').
 *   - foul vs kupura (same beans, different dish) -> score 0.636 -> below verify -> accepted.
 */
final class DuplicateDetectionServiceTest extends TestCase
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

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------

    private function service(?AiDuplicateJudge $judge = null, ?EmbeddingProvider $provider = null): DuplicateDetectionService
    {
        return new DuplicateDetectionService(
            $this->fingerprints,
            new CandidateRetriever($this->fingerprints, $provider ?? $this->provider, $this->store),
            new SimilarityScorer,
            $judge ?? $this->judge,
            $provider ?? $this->provider,
        );
    }

    private function registrar(?DuplicateDetectionService $service = null, ?EmbeddingService $embeddings = null): RecipeRegistrar
    {
        return new RecipeRegistrar(
            $service ?? $this->service(),
            $this->fingerprints,
            $embeddings ?? new EmbeddingService($this->provider, $this->store),
        );
    }

    private function candidate(string $fixture, array $overrides = [], array $meta = []): CandidateRecipe
    {
        $draft = RecipeFixtures::{$fixture}();

        if ($overrides !== []) {
            $draft = [...$draft, ...$overrides];
        }

        if ($meta !== []) {
            $draft['meta'] = [...($draft['meta'] ?? []), ...$meta];
        }

        return CandidateRecipe::fromDraft($draft);
    }

    /** @return array{0: Recipe, 1: RecipeFingerprint} */
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

    private function registerFixture(string $fixture): array
    {
        return $this->registerCandidate($this->candidate($fixture));
    }

    private function latestCheck(): DuplicateCheck
    {
        $check = DuplicateCheck::query()->latest('id')->first();
        $this->assertNotNull($check, 'expected a duplicate_checks row');

        return $check;
    }

    /**
     * The baked-technique Alfredo variant: same ingredients, different
     * cooking method + title -> lands in the verify band (0.7206 measured).
     */
    private function bakedCandidate(): CandidateRecipe
    {
        return CandidateRecipe::fromDraft([
            ...RecipeFixtures::chickenAlfredoClassic(),
            'title' => 'Baked Chicken Alfredo Casserole',
            'description' => 'Everything goes under the broiler in a casserole dish with a breadcrumb crust.',
            'steps' => [
                'Cook the fettuccine until barely al dente and drain.',
                'Spread the pasta in a buttered casserole dish, top with sliced chicken.',
                'Pour the cream and parmesan sauce over, scatter butter and breadcrumbs.',
                'Bake in the oven at 200C until golden and bubbling, about 25 minutes.',
            ],
            'keywords' => ['alfredo', 'casserole', 'baked'],
        ]);
    }

    // -----------------------------------------------------------------
    // Scenarios 1-18 (brief numbering)
    // -----------------------------------------------------------------

    /**
     * Scenario 1: identical recipes, identical titles -> duplicate LAYER 1
     * (the exact fingerprint hit decides before any retrieval/scoring/AI).
     */
    public function test_scenario_1_identical_recipe_identical_title_is_layer_1_duplicate(): void
    {
        [$recipe] = $this->registerFixture('carbonaraRaw');

        $decision = $this->service()->evaluate($this->candidate('carbonaraRaw'));

        $this->assertTrue($decision->isDuplicate);
        $this->assertSame('duplicate', $decision->action);
        $this->assertSame(1, $decision->layer);
        $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);
        $this->assertSame(1.0, $decision->confidence);
        $this->assertSame(0, $this->judge->calls); // layer 1 never consults the judge

        $check = $this->latestCheck();
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $check->action);
        $this->assertSame(1, $check->layer);
        $this->assertTrue($check->is_duplicate);
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $check->status);
        $this->assertNull($check->scores); // no structural scoring happened
    }

    /**
     * Scenario 2: same dish, different title and wording (carbonara vs
     * carbonaraAlternate) -> duplicate via LAYER 2, not layer 1: the qty
     * binning makes the exact fingerprints DIFFER (400 g vs 450 g spaghetti,
     * 100 g vs 90 g pecorino) while the identity signature matches, so the
     * structural scorer corroborates the match instead.
     */
    public function test_scenario_2_reworded_same_dish_is_layer_2_structural_duplicate(): void
    {
        [$recipe, $rawRow] = $this->registerFixture('carbonaraRaw');

        $alternate = $this->candidate('carbonaraAlternate');
        $alternateSet = $this->fingerprints->fingerprintSet($alternate);

        // Documented calibration: fingerprints differ, identity signature matches.
        $this->assertNotSame($rawRow->fingerprint, $alternateSet->fingerprint);
        $this->assertSame($rawRow->identity_signature, $alternateSet->identitySignature);

        $decision = $this->service()->evaluate($alternate);

        $this->assertTrue($decision->isDuplicate);
        $this->assertSame('duplicate', $decision->action);
        $this->assertSame(2, $decision->layer);
        $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);
        $this->assertNotNull($decision->score);
        $this->assertTrue($decision->score->passesCorroboration);
        $this->assertStringContainsString('corroborated', (string) $decision->reason);
        $this->assertSame(0, $this->judge->calls); // auto-dupe decided without AI
    }

    /**
     * Scenario 3: different title + description with identical normalized
     * ingredients/prep (the same calibrated pair) -> duplicate AND the
     * audit row carries the full scores JSON (total/features/corroboration)
     * plus layer + action for a REJECTED decision.
     */
    public function test_scenario_3_layer_2_duplicate_records_scores_layer_and_action(): void
    {
        $this->registerFixture('carbonaraRaw');

        $decision = $this->service()->evaluate($this->candidate('carbonaraAlternate'));

        $this->assertSame('duplicate', $decision->action);
        $this->assertNotNull($decision->checkId);

        $check = DuplicateCheck::query()->findOrFail($decision->checkId);
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $check->action);
        $this->assertSame(2, $check->layer);
        $this->assertIsArray($check->scores);
        $this->assertGreaterThanOrEqual(0.88, $check->scores['total']);
        $this->assertTrue($check->scores['passes_corroboration']);
        $this->assertArrayHasKey('vector_cosine', $check->scores['features']);
        $this->assertArrayHasKey('main_ingredients_jaccard', $check->scores['features']);
        $this->assertNotSame('', $check->scores['explanation']);
        $this->assertTrue($check->is_duplicate);
    }

    /**
     * Scenario 4: same dish, slightly different quantities. Pecorino
     * 100 g -> 80 g crosses a bin boundary (<100 g steps by 5), so the
     * exact fingerprint differs and layer 2 decides the duplicate; the
     * 100 g -> 110 g variant stays INSIDE the >=100 g bin (step 25) and
     * collapses to the same exact fingerprint -> layer 1.
     */
    public function test_scenario_4_quantity_binning_decides_the_layer(): void
    {
        [$recipe, $rawRow] = $this->registerFixture('carbonaraRaw');

        $swapPecorino = fn (string $line): CandidateRecipe => $this->candidate('carbonaraRaw', [
            'ingredients' => array_map(
                fn (string $line0): string => str_contains($line0, '100 g Pecorino') ? $line : $line0,
                RecipeFixtures::carbonaraRaw()['ingredients'],
            ),
        ]);

        // 80 g: a DIFFERENT exact fingerprint -> layer 2 duplicate.
        $eighty = $swapPecorino('80 g Pecorino Romano, finely grated');
        $eightySet = $this->fingerprints->fingerprintSet($eighty);
        $this->assertNotSame($rawRow->fingerprint, $eightySet->fingerprint);

        $decision = $this->service()->evaluate($eighty);
        $this->assertTrue($decision->isDuplicate);
        $this->assertSame(2, $decision->layer);
        $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);

        // 110 g: same bin as 100 g -> the SAME exact fingerprint -> layer 1.
        $hundredTen = $swapPecorino('110 g Pecorino Romano, finely grated');
        $hundredTenSet = $this->fingerprints->fingerprintSet($hundredTen);
        $this->assertSame($rawRow->fingerprint, $hundredTenSet->fingerprint);

        $decision = $this->service()->evaluate($hundredTen);
        $this->assertTrue($decision->isDuplicate);
        $this->assertSame(1, $decision->layer);
    }

    /**
     * Scenario 5: same dish, different UNITS of the same unit class —
     * 240 ml vs 1 cup vs 16 tbsp are one volume class -> the normalizer's
     * class conversion lands on the SAME exact fingerprint -> layer 1
     * duplicate.
     */
    public function test_scenario_5_equivalent_units_collapse_to_layer_1(): void
    {
        [$recipe] = $this->registerFixture('chickenAlfredoClassic');

        $swapCream = fn (string $line): CandidateRecipe => $this->candidate('chickenAlfredoClassic', [
            'ingredients' => array_map(
                fn (string $line0): string => str_contains($line0, '240 ml heavy cream') ? $line : $line0,
                RecipeFixtures::chickenAlfredoClassic()['ingredients'],
            ),
        ]);

        foreach (['240 ml heavy cream', '1 cup heavy cream', '16 tbsp heavy cream'] as $cream) {
            $decision = $this->service()->evaluate($swapCream($cream));

            $this->assertTrue($decision->isDuplicate, "unit variant [$cream] should duplicate");
            $this->assertSame(1, $decision->layer, "unit variant [$cream] should hit the exact fingerprint");
            $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);
        }
    }

    /**
     * Scenario 6: ingredient synonyms — parmigiano reggiano normalizes to
     * parmesan cheese -> same exact fingerprint -> layer 1 duplicate.
     */
    public function test_scenario_6_ingredient_synonyms_normalize(): void
    {
        [$recipe] = $this->registerFixture('chickenAlfredoClassic');

        $parmigiano = $this->candidate('chickenAlfredoClassic', [
            'ingredients' => array_map(
                fn (string $line): string => str_contains($line, '100 g parmesan')
                    ? '100 g parmigiano reggiano, grated' : $line,
                RecipeFixtures::chickenAlfredoClassic()['ingredients'],
            ),
        ]);

        $set = $this->fingerprints->fingerprintSet($parmigiano);
        $registered = $this->fingerprints->forRecipe((int) $recipe->id);
        $this->assertNotNull($registered);
        $this->assertSame($registered->fingerprint, $set->fingerprint);

        $decision = $this->service()->evaluate($parmigiano);

        $this->assertTrue($decision->isDuplicate);
        $this->assertSame(1, $decision->layer);
        $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);
    }

    /**
     * Scenario 7: same mains, different techniques (simmered alfredo vs a
     * baked casserole) — the canonical dish breaks ('baked chicken alfredo
     * casserole' != 'chicken alfredo'), the score drops to the verify band
     * (0.7206) and the judge separates the dishes -> accepted as distinct,
     * proven by the fake judge's default canonical-dish rule (no handler).
     */
    public function test_scenario_7_same_mains_different_techniques_go_to_the_judge_and_stay_distinct(): void
    {
        $this->registerFixture('chickenAlfredoClassic');

        $decision = $this->service()->evaluate($this->bakedCandidate());

        $this->assertSame('accepted', $decision->action);
        $this->assertSame(3, $decision->layer);
        $this->assertSame('distinct', $decision->classification);
        $this->assertFalse($decision->isDuplicate);
        $this->assertNull($decision->matchedRecipeId);
        $this->assertSame(1, $this->judge->calls);
    }

    /**
     * Scenario 8: same base ingredients, genuinely different dish (fava
     * bean stew vs ful medames) -> best structural score 0.636 < verify
     * 0.68 -> accepted in layer 2 without any AI call, match id absent,
     * audit row accepted/resolved with the score JSON recorded.
     */
    public function test_scenario_8_same_ingredients_different_dish_is_accepted_below_verify(): void
    {
        $this->registerFixture('foulMedames');

        $decision = $this->service()->evaluate($this->candidate('kupuraBeanStew'));

        $this->assertSame('accepted', $decision->action);
        $this->assertSame(2, $decision->layer); // below the verify threshold -> no judge
        $this->assertNull($decision->matchedRecipeId);
        $this->assertFalse($decision->isDuplicate);
        $this->assertNotNull($decision->score);
        $this->assertLessThan(0.68, $decision->score->total);
        $this->assertSame(0, $this->judge->calls);

        $check = $this->latestCheck();
        $this->assertSame(DuplicateCheck::ACTION_ACCEPTED, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $check->status);
        $this->assertFalse($check->is_duplicate);
        $this->assertIsArray($check->scores);
        $this->assertGreaterThan(0.0, $check->scores['total']);
        $this->assertLessThan(0.68, $check->scores['total']);
    }

    /**
     * Scenario 9: regional variation (Cajun spin on the Italian-American
     * classic). An operator raising auto_duplicate to 0.99 (preferring AI
     * verification over structural auto-reject) sends the corroborated
     * 0.9225 pair to the judge; the FakeAiDuplicateJudge handler returns
     * meaningful_variation -> accepted, layer 3, differences preserved.
     */
    public function test_scenario_9_regional_variation_reaches_the_judge_and_is_accepted(): void
    {
        config(['recipe_dedup.thresholds.auto_duplicate' => 0.99]);

        [$classic] = $this->registerFixture('chickenAlfredoClassic');

        $seen = []; // judge input captured for the contract assert
        $this->judge->handler = function (array $existing, CandidateRecipe $candidate) use (&$seen) {
            $seen = [$existing, $candidate->title];

            return new AiJudgeResponse(
                classification: AiJudgeResponse::CLASSIFICATION_MEANINGFUL_VARIATION,
                isDuplicate: false,
                matchedRecipeId: null,
                confidence: 0.88,
                reason: 'Same dish family but a genuinely different spicing profile',
                differences: ['cajun spice blend', 'cayenne heat'],
            );
        };

        $decision = $this->service()->evaluate($this->candidate('chickenAlfredoSpicy'));

        $this->assertSame('accepted', $decision->action);
        $this->assertSame(3, $decision->layer);
        $this->assertSame('meaningful_variation', $decision->classification);
        $this->assertFalse($decision->isDuplicate);
        $this->assertSame(['cajun spice blend', 'cayenne heat'], $decision->differences);
        $this->assertSame(1, $this->judge->calls);

        // The judge only ever saw the classic alfredo + the spicy candidate.
        $this->assertSame([(int) $classic->id], array_column($seen[0], 'id'));
        $this->assertSame('Spicy Cajun Chicken Alfredo', $seen[1]);
    }

    /**
     * Scenario 10: the meaningful_variation verdict is also persisted
     * faithfully — classification + ai_confidence + is_duplicate=false +
     * accepted/resolved + the structural score JSON on the check row.
     */
    public function test_scenario_10_meaningful_variation_verdict_is_recorded(): void
    {
        config(['recipe_dedup.thresholds.auto_duplicate' => 0.99]);

        $this->registerFixture('chickenAlfredoClassic');

        $this->judge->handler = fn (): AiJudgeResponse => new AiJudgeResponse(
            classification: AiJudgeResponse::CLASSIFICATION_MEANINGFUL_VARIATION,
            isDuplicate: false,
            matchedRecipeId: null,
            confidence: 0.9,
            reason: 'Regional spicing variant',
            differences: ['cajun seasoning'],
        );

        $decision = $this->service()->evaluate($this->candidate('chickenAlfredoSpicy'));

        $this->assertSame('accepted', $decision->action);
        $this->assertSame(3, $decision->layer);
        $this->assertNotNull($decision->checkId);

        $check = DuplicateCheck::query()->findOrFail($decision->checkId);
        $this->assertSame('meaningful_variation', $check->classification);
        $this->assertSame(0.9, $check->ai_confidence);
        $this->assertFalse($check->is_duplicate);
        $this->assertSame(DuplicateCheck::ACTION_ACCEPTED, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $check->status);
        $this->assertIsArray($check->scores);
        $this->assertGreaterThan(0.0, $check->scores['total']);
        $this->assertSame('Regional spicing variant', $check->reason);
    }

    /**
     * Scenario 11: batch-internal duplicates — register candidate A through
     * the registrar with a generation batch, then register identical B on
     * the SAME batch: layer 1 catches B (A is committed already), B is
     * dropped BEFORE inserting a second recipe row, recipe count stays 1,
     * and both check rows carry source=generation + the batch id.
     */
    public function test_scenario_11_batch_internal_duplicate_never_creates_a_second_recipe(): void
    {
        $batch = RecipeGenerationBatch::create([
            'requested_count' => 5,
            'max_attempts' => 15,
            'status' => RecipeGenerationBatch::STATUS_RUNNING,
            'params' => ['cuisine' => 'italian'],
        ]);
        $registrar = $this->registrar();

        $first = $registrar->register($this->candidate('carbonaraRaw'), $batch);
        $this->assertTrue($first->accepted());

        $second = $registrar->register($this->candidate('carbonaraRaw'), $batch);

        $this->assertFalse($second->accepted());
        $this->assertNull($second->recipe);
        $this->assertTrue($second->decision->isDuplicate);
        $this->assertSame(1, $second->decision->layer);
        $this->assertSame((int) $first->recipe?->id, $second->decision->matchedRecipeId);
        $this->assertSame(1, Recipe::query()->count(), 'the second identical registration must not create a recipe');

        $firstCheck = DuplicateCheck::query()->findOrFail((int) $first->decision->checkId);
        $this->assertSame(DuplicateCheck::SOURCE_GENERATION, $firstCheck->source);
        $this->assertSame((int) $batch->id, (int) $firstCheck->batch_id);

        $secondCheck = $this->latestCheck();
        $this->assertSame(DuplicateCheck::SOURCE_GENERATION, $secondCheck->source);
        $this->assertSame((int) $batch->id, (int) $secondCheck->batch_id);
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $secondCheck->action);
    }

    /**
     * Scenario 12: duplicate against an existing DB record — the registered
     * recipe A is named in BOTH the decision and the audit row
     * (matched_recipe_id = A, layer 1, is_duplicate true, resolved).
     */
    public function test_scenario_12_duplicate_against_existing_record_names_the_match(): void
    {
        [$recipeA] = $this->registerFixture('carbonaraRaw');

        $decision = $this->service()->evaluate($this->candidate('carbonaraRaw'));

        $this->assertTrue($decision->isDuplicate);
        $this->assertSame(1, $decision->layer);
        $this->assertSame((int) $recipeA->id, $decision->matchedRecipeId);
        $this->assertNotNull($decision->checkId);

        $check = DuplicateCheck::query()->findOrFail((int) $decision->checkId);
        $this->assertSame((int) $recipeA->id, (int) $check->matched_recipe_id);
        $this->assertSame(1, $check->layer);
        $this->assertTrue($check->is_duplicate);
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_RESOLVED, $check->status);
    }

    /**
     * Scenario 13: the fingerprint-collision race — a competing writer
     * already holds the candidate's exact fingerprint (pre-inserted on
     * another recipe; the candidate evaluates as clean because the row is
     * its own putative recipe id, then collides on INSERT). The registrar
     * resolves the race QUIETLY: a layer-1 duplicate of the holder, NO
     * recipe/step rows left behind, a 'fingerprint collision on insert'
     * audit row.
     *
     * NOTE (slice 6+): a TRUE inter-process race is the queue worker's
     * domain; a transaction-level test exists in RecipeRegistrarTest.
     */
    public function test_scenario_13_fingerprint_collision_resolves_to_duplicate_with_no_recipe(): void
    {
        // The "other writer": an unrelated recipe holding the candidate's
        // exact fingerprint row.
        $holder = Recipe::create(['title' => 'Tomato Basil Pasta', 'steps_count' => 1]);

        $candidate = $this->candidate('carbonaraRaw');
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

        // The candidate claims the holder's row as "its own recipe id", so
        // evaluate() excludes it and misses the collision (the race window),
        // while the INSERT still hits the UNIQUE(fingerprint) guard.
        $racing = $this->candidate('carbonaraRaw', [], ['recipe_id' => (int) $holder->id]);

        $result = $this->registrar()->register($racing);

        $this->assertFalse($result->accepted());
        $this->assertNull($result->recipe);
        $this->assertTrue($result->decision->isDuplicate);
        $this->assertSame('duplicate', $result->decision->action);
        $this->assertSame(1, $result->decision->layer);
        $this->assertSame((int) $holder->id, $result->decision->matchedRecipeId);

        // No orphan recipe or steps: the rolled-back insert left nothing.
        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame('Tomato Basil Pasta', Recipe::query()->sole()->title);
        $this->assertSame(0, RecipeStep::query()->count());

        $check = $this->latestCheck();
        $this->assertSame(1, $check->layer);
        $this->assertSame(DuplicateCheck::ACTION_REJECTED_DUPLICATE, $check->action);
        $this->assertTrue($check->is_duplicate);
        $this->assertSame('fingerprint collision on insert', $check->reason);
        $this->assertSame((int) $holder->id, (int) $check->matched_recipe_id);
        $this->assertNull($check->batch_id);
        $this->assertNull($check->scores);
    }

    /**
     * Scenario 14: failed embedding generation — a provider that throws on
     * every embed() call must not break detection: the exact path (layer 1)
     * never consults embeddings at all, and the structural path still
     * produces a decision with the vector feature EXCLUDED (absent from the
     * features map — never scored as 0).
     */
    public function test_scenario_14_failing_embeddings_still_produce_decisions(): void
    {
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
                throw new EmbeddingException('embeddings down');
            }
        };

        [$recipe] = $this->registerFixture('carbonaraRaw');

        // Layer 1 needs no embeddings at all — the exact hit decides.
        $decision = $this->service(null, $throwing)->evaluate($this->candidate('carbonaraRaw'));
        $this->assertTrue($decision->isDuplicate);
        $this->assertSame(1, $decision->layer);
        $this->assertSame((int) $recipe->id, $decision->matchedRecipeId);

        // Structural path: vector source fails -> source skipped; the score
        // runs on the structured features only (baked lands below verify
        // without its vector) — a decision, not an exception.
        $this->registerFixture('chickenAlfredoClassic');
        $decision = $this->service(null, $throwing)->evaluate($this->bakedCandidate());

        $this->assertSame('accepted', $decision->action);
        $this->assertSame(2, $decision->layer); // vector-less score stays under verify
        $this->assertNotNull($decision->score);
        $this->assertArrayNotHasKey('vector_cosine', $decision->score->features);
        $this->assertArrayHasKey('main_ingredients_jaccard', $decision->score->features);
        $this->assertSame(0, $this->judge->calls);

        $check = $this->latestCheck();
        $this->assertSame(DuplicateCheck::ACTION_ACCEPTED, $check->action);
        $this->assertArrayNotHasKey('vector_cosine', (array) ($check->scores['features'] ?? []));
    }

    /**
     * Scenario 15: AI judge outage — the default on_failure policy (flag)
     * turns the throw into a needs_review decision (never a silent accept
     * or reject), audit row flagged_review / needs_review status, and the
     * is_duplicate column stays NULL while undecided.
     */
    public function test_scenario_15_judge_outage_flags_for_review_by_default(): void
    {
        $this->registerFixture('chickenAlfredoClassic');

        $this->judge->throws = new AiJudgeException('judge provider is down');

        $decision = $this->service()->evaluate($this->bakedCandidate());

        $this->assertSame('needs_review', $decision->action);
        $this->assertSame(3, $decision->layer);
        $this->assertFalse($decision->isDuplicate);
        $this->assertNull($decision->matchedRecipeId);
        $this->assertStringContainsString('flagged for review', (string) $decision->reason);

        $check = $this->latestCheck();
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_NEEDS_REVIEW, $check->status);
        $this->assertNull($check->is_duplicate);
        $this->assertIsArray($check->scores); // the layer-2 score survived into the audit row
    }

    /**
     * Scenario 16: AI judge invalid JSON — the REAL HttpAiDuplicateJudge
     * behind the service, with the endpoint returning a mangled body: the
     * unparseable structured response raises AiJudgeException -> the same
     * flag-for-review policy applies (one HTTP attempt; unparseable bodies
     * are not retried).
     */
    public function test_scenario_16_invalid_judge_json_flags_for_review(): void
    {
        config([
            'recipe_dedup.ai_judge.enabled' => true,
            'recipe_dedup.ai_judge.protocol' => 'openai_compatible',
            'recipe_dedup.ai_judge.endpoint' => 'https://judge.invalid.test/v1',
            'recipe_dedup.ai_judge.api_key' => 'sk-test',
            'recipe_dedup.ai_judge.model' => 'verdict-model',
            'recipe_dedup.ai_judge.timeout' => 5,
            'recipe_dedup.ai_judge.retries' => 1,
            'recipe_dedup.ai_judge.max_candidates' => 5,
        ]);
        Http::fake([
            'judge.invalid.test/*' => Http::response('<html>totally not json</html>', 200),
        ]);

        $this->registerFixture('chickenAlfredoClassic');

        $realJudge = new HttpAiDuplicateJudge(config('recipe_dedup.ai_judge'));
        $decision = $this->service($realJudge)->evaluate($this->bakedCandidate());

        $this->assertSame('needs_review', $decision->action);
        $this->assertSame(3, $decision->layer);
        Http::assertSentCount(1);

        $check = $this->latestCheck();
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $check->action);
        $this->assertSame(DuplicateCheck::STATUS_NEEDS_REVIEW, $check->status);
    }

    /**
     * Scenario 17 (explicitly not slice 4): backfill/resume semantics —
     * chunked, queued, resumable re-evaluation of EXISTING recipes —
     * belongs to slice 6. Kept untested here on purpose.
     */
    public function test_scenario_17_backfill_resume_is_slice_6(): void
    {
        $this->markTestSkipped('Backfill/resume semantics are slice 6 — deliberately not exercised in slice 4.');
    }

    /**
     * Scenario 18: incomplete metadata is never auto-rejected —
     * (a) a DEGRADED fingerprint row (is_complete=false) matching exactly
     *     only FLAGS review even though the fingerprint is exact;
     * (b) a degenerate CANDIDATE (empty ingredients) matching a stored row
     *     only FLAGs review — the reason names the degraded candidate.
     */
    public function test_scenario_18_degraded_rows_and_candidates_never_auto_reject(): void
    {
        // (a) degraded stored row + healthy candidate.
        [, $row] = $this->registerFixture('carbonaraRaw');
        RecipeFingerprint::query()->whereKey($row->id)->update(['is_complete' => false]);

        $decision = $this->service()->evaluate($this->candidate('carbonaraRaw'));

        $this->assertSame('needs_review', $decision->action);
        $this->assertSame(1, $decision->layer);
        $this->assertFalse($decision->isDuplicate);
        $this->assertNull($this->latestCheck()->is_duplicate);
        $this->assertSame(DuplicateCheck::ACTION_FLAGGED_REVIEW, $this->latestCheck()->action);
        $this->assertStringContainsString('degraded fingerprint row', (string) $decision->reason);

        // (b) degenerate candidate (no ingredients) whose own degraded row
        // exists: the same exact fingerprint, but the candidate's metadata
        // is broken — flagged, not rejected.
        $degenerateDraft = [...RecipeFixtures::carbonaraRaw(), 'ingredients' => [], 'steps' => []];
        $degenerate = CandidateRecipe::fromDraft($degenerateDraft);
        $this->registerCandidate($degenerate); // stored with is_complete=false

        $decision = $this->service()->evaluate($this->candidate('carbonaraRaw', ['ingredients' => [], 'steps' => []]));

        $this->assertSame('needs_review', $decision->action);
        $this->assertSame(1, $decision->layer);
        $this->assertFalse($decision->isDuplicate);
        $this->assertStringContainsString('candidate metadata is degraded', (string) $decision->reason);
    }
}
