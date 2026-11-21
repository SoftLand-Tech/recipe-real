<?php

namespace Tests\Feature\RecipeDedup;

use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\Data\FingerprintSet;
use App\Services\RecipeDedup\Detection\CandidateRetrieval;
use App\Services\RecipeDedup\Detection\CandidateRetriever;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Embeddings\EmbeddingTextBuilder;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\Vector\NullVectorStore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

/**
 * The indexed-sourcing contract of layer-2 retrieval: every source,
 * the priority union, the vector cutoff, the cap, and the meta
 * enrichment. All semantic IO rides on the deterministic fakes.
 */
final class CandidateRetrieverTest extends TestCase
{
    use RefreshDatabase;

    private FingerprintService $fingerprints;

    private FakeEmbeddingProvider $provider;

    private FakeVectorStore $store;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fingerprints = new FingerprintService;
        $this->provider = new FakeEmbeddingProvider;
        $this->store = new FakeVectorStore;
    }

    private function retriever(?EmbeddingProvider $provider = null): CandidateRetriever
    {
        return new CandidateRetriever($this->fingerprints, $provider ?? $this->provider, $this->store);
    }

    private function candidate(string $fixture, array $overrides = []): CandidateRecipe
    {
        return CandidateRecipe::fromDraft([...RecipeFixtures::{$fixture}(), ...$overrides]);
    }

    private function registerFixture(string $fixture): array // [Recipe, RecipeFingerprint]
    {
        $candidate = $this->candidate($fixture);

        return $this->registerCandidate($candidate);
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

    private function retrieveFor(CandidateRecipe $candidate): CandidateRetrieval
    {
        $identity = $this->fingerprints->identity($candidate);
        $set = $this->fingerprints->fingerprintSet($candidate, $identity);

        return $this->retriever()->retrieve($candidate, $identity, $set);
    }

    public function test_exact_fingerprint_source_finds_a_registered_recipe(): void
    {
        [$recipe] = $this->registerFixture('carbonaraRaw');

        $retrieval = $this->retrieveFor($this->candidate('carbonaraRaw'));

        $this->assertSame(1, count($retrieval->identities));
        $this->assertSame((int) $recipe->id, $retrieval->identities[0]['id']);
        // Priority: the exact hit is reported even though the same recipe
        // also matches the identity_signature + main hash sources.
        $this->assertSame('exact_fingerprint', $retrieval->candidates[0]->meta['retrieval_source']);
    }

    public function test_reworded_duplicate_arrives_via_identity_signature(): void
    {
        // Calibrated fixture pair: SAME identity_signature + main hash,
        // DIFFERENT fingerprint (worded quantities/steps) and different
        // title. The union must report it via the identity signature.
        [$registered] = $this->registerFixture('carbonaraRaw');

        $retrieval = $this->retrieveFor($this->candidate('carbonaraAlternate'));

        $this->assertNotEmpty($retrieval->identities);
        $this->assertSame((int) $registered->id, $retrieval->identities[0]['id']);
        $this->assertSame('identity_signature', $retrieval->candidates[0]->meta['retrieval_source']);
    }

    public function test_same_mains_variant_arrives_via_main_ingredient_hash(): void
    {
        // Calibrated fixture pair: alfredo spicy vs classic share the main
        // ingredients (so the main hash matches) but differ in flavor
        // markers (so the identity_signature differs).
        [$registered, $row] = $this->registerFixture('chickenAlfredoClassic');
        $candidate = $this->candidate('chickenAlfredoSpicy');

        // Calibration sanity (guards against fixture drift).
        $set = $this->fingerprints->fingerprintSet($candidate);
        $this->assertNotSame($row->identity_signature, $set->identitySignature);
        $this->assertSame($row->main_ingredient_hash, $set->mainIngredientHash);

        $retrieval = $this->retrieveFor($candidate);

        $this->assertSame((int) $registered->id, $retrieval->identities[0]['id']);
        $this->assertSame('main_ingredient_hash', $retrieval->candidates[0]->meta['retrieval_source']);
    }

    public function test_title_signature_source_is_the_lowest_priority_fallback(): void
    {
        $candidate = $this->candidate('kupuraBeanStew');
        $set = $this->fingerprints->fingerprintSet($candidate);

        // A recipe whose fingerprint row matches ONLY the title signature.
        $recipe = Recipe::create(['title' => $candidate->title, 'steps_count' => 1]);
        $this->craftFingerprintRow($recipe, $candidate, [
            // Every other hash deliberately mismatched: title signature is
            // the ONLY source that can return this recipe.
            'fingerprint' => 'fp-title-craft',
            'identity_signature' => 'sig-title-craft',
            'ingredient_combo_hash' => 'combo-title-craft',
            'main_ingredient_hash' => 'main-title-craft',
            'title_signature' => $set->titleSignature,
        ]);

        $retrieval = $this->retrieveFor($candidate);

        $this->assertSame([(int) $recipe->id], array_column($retrieval->identities, 'id'));
        $this->assertSame('title_signature', $retrieval->candidates[0]->meta['retrieval_source']);
    }

    public function test_vector_source_hits_and_carries_the_score(): void
    {
        // Register + index ful medames. The candidate then uses a FRESH
        // FingerprintSet with all-distinct hashes (no structured hit) but
        // the SAME identity — so only the vector source can find it, with
        // a cosine of exactly 1.0.
        [$recipe, $row] = $this->registerFixture('foulMedames');
        $identity = $this->fingerprints->deserializeIdentity($row->identity);
        $this->assertNotNull($identity);

        (new EmbeddingService($this->provider, $this->store))
            ->ensureIndexedGivenIdentity($recipe, $identity, $row);

        $candidate = $this->candidate('kupuraBeanStew');
        $candidateIdentity = $this->fingerprints->identity($candidate);

        $retrieval = $this->retriever()->retrieve(
            $candidate,
            $identity, // embeds/filters exactly like the stored point
            self::disjointSet(),
        );

        $this->assertSame([(int) $recipe->id], array_column($retrieval->identities, 'id'));
        $this->assertSame('vector', $retrieval->candidates[0]->meta['retrieval_source']);
        $this->assertSame(1.0, round((float) $retrieval->candidates[0]->meta['vector_score'], 6));
        $this->assertSame(['main_ingredient_hash' => 0, 'vector' => 1], [
            'main_ingredient_hash' => $retrieval->sources['main_ingredient_hash'],
            'vector' => $retrieval->sources['vector'],
        ]);
        // The candidate's own vector rides along for layer-2 scoring.
        $this->assertNotNull($retrieval->vector);
        $this->assertCount(FakeEmbeddingProvider::DIMENSIONS, $retrieval->vector);
    }

    public function test_vector_hits_below_the_min_score_are_cut_but_return_when_the_floor_drops(): void
    {
        // Two indexed points: ful medames (the same identity → 1.0) and a
        // deliberately unrelated "dessert" identity sharing ONLY the
        // equality-filter keys (dish_family/cuisine) — its cosine vs the
        // candidate is well below the 0.55 retrieval floor.
        [$foul, $foulRow] = $this->registerFixture('foulMedames');
        $foulIdentity = $this->fingerprints->deserializeIdentity($foulRow->identity);
        $this->assertNotNull($foulIdentity);

        $dessert = Recipe::create(['title' => 'Basbousa Semolina Cake', 'steps_count' => 2]);
        $this->fingerprints->register($dessert); // identity joinable in retrieval

        // Point for the dessert with cosine EXACTLY 0.40 vs the candidate:
        // companion = 0.4*dir(candidate) + 0.9165*e[slot] on a zero slot —
        // unit-length, so the FakeVectorStore's own cosine agrees.
        $candidateVector = FakeEmbeddingProvider::vectorize(
            EmbeddingTextBuilder::build($foulIdentity),
        );
        $norm = sqrt(array_sum(array_map(fn (float $x): float => $x * $x, $candidateVector)));
        $dir = array_map(fn (float $x): float => $x / $norm, $candidateVector);
        $slot = (int) array_search(0.0, $dir, true); // a zero coordinate of the bag vector
        $this->assertNotFalse($slot);

        $companion = array_map(fn (float $x): float => 0.4 * $x, $dir);
        $companion[$slot] = sqrt(1.0 - 0.4 ** 2); // orthogonal on the empty coordinate

        $this->store->upsertMany([[
            'id' => (int) $dessert->id,
            'vector' => $companion,
            'payload' => [
                'recipe_id' => (int) $dessert->id,
                'dish_family' => (string) $foulIdentity->dishFamily, // passes the equality filters
                'cuisine' => (string) $foulIdentity->cuisine,
            ],
        ]]);

        // ful's own point, indexed through the real service.
        (new EmbeddingService($this->provider, $this->store))
            ->ensureIndexedGivenIdentity($foul, $foulIdentity, $foulRow);

        $retrieval = $this->retriever()->retrieve(
            $this->candidate('kupuraBeanStew'),
            $foulIdentity,
            self::disjointSet(),
        );

        $this->assertSame([(int) $foul->id], array_column($retrieval->identities, 'id'));

        // Drop the floor to 0: the low-cosine point becomes a hit.
        config(['recipe_dedup.retrieval.min_vector_score' => 0.0]);
        $retrieval = $this->retriever()->retrieve(
            $this->candidate('kupuraBeanStew'),
            $foulIdentity,
            self::disjointSet(),
        );

        $ids = array_column($retrieval->identities, 'id');
        $this->assertContains((int) $dessert->id, $ids);
        $this->assertContains((int) $foul->id, $ids);
        // ... and vector entries are rank-ordered: the perfect match first.
        $this->assertSame((int) $foul->id, $retrieval->identities[0]['id']);
    }

    public function test_max_candidates_caps_the_union_deterministically(): void
    {
        config(['recipe_dedup.retrieval.max_candidates' => 2]);

        // Four fresh recipes whose ONLY match against the candidate is the
        // identity signature (every other hash deliberately mismatched).
        $candidate = $this->candidate('shakshukaCaftan');
        $identity = $this->fingerprints->identity($candidate);
        $set = $this->fingerprints->fingerprintSet($candidate, $identity);

        $recipes = [];
        foreach (['Shakshuka One', 'Shakshuka Two', 'Shakshuka Three'] as $index => $title) {
            $recipes[] = Recipe::create(['title' => $title, 'steps_count' => 2]);
            $this->craftFingerprintRow($recipes[$index], $candidate, [
                'fingerprint' => 'fp-cap-'.($index + 1), // distinct exact fingerprints: none match
                'identity_signature' => $set->identitySignature,
                'ingredient_combo_hash' => 'combo-cap-'.($index + 1),
                'main_ingredient_hash' => 'main-cap-'.($index + 1),
                'title_signature' => 'title-cap-'.($index + 1),
            ]);
        }

        $retrieval = $this->retriever()->retrieve($candidate, $identity, $set);

        $this->assertCount(2, $retrieval->identities, 'the union is capped at max_candidates');
        // Deterministic picks: recipe_id ASC within the source.
        $this->assertSame(
            [(int) $recipes[0]->id, (int) $recipes[1]->id],
            array_column($retrieval->identities, 'id'),
        );
        $this->assertSame('identity_signature', $retrieval->candidates[0]->meta['retrieval_source']);
    }

    public function test_exclude_is_honored_across_sources(): void
    {
        [$recipe, $row] = $this->registerFixture('carbonaraRaw');
        $candidate = $this->candidate('carbonaraRaw');
        $identity = $this->fingerprints->identity($candidate);
        $set = $this->fingerprints->fingerprintSet($candidate, $identity);

        // Index its point too: even the vector source must not return the
        // excluded recipe.
        (new EmbeddingService($this->provider, $this->store))
            ->ensureIndexedGivenIdentity($recipe, $this->fingerprints->deserializeIdentity($row->identity), $row);

        $retrieval = $this->retriever()->retrieve($candidate, $identity, $set, $recipe);

        $this->assertTrue($retrieval->isEmpty());
    }

    public function test_degraded_fingerprint_rows_never_match_the_exact_source(): void
    {
        $candidate = $this->candidate('carbonaraRaw');
        $set = $this->fingerprints->fingerprintSet($candidate);

        $recipe = Recipe::create(['title' => 'Degraded twin', 'steps_count' => 0]);
        $this->craftFingerprintRow($recipe, $candidate, [
            'fingerprint' => $set->fingerprint,
            'identity_signature' => 'crafted-not-matching',
            'main_ingredient_hash' => 'crafted-not-matching',
            'title_signature' => 'crafted-not-matching',
        ], isComplete: false);

        $retrieval = $this->retrieveFor($candidate);

        $this->assertSame([], $retrieval->identities, 'exact source ignores is_complete=false rows');
        $this->assertSame(0, $retrieval->sources['exact_fingerprint']);
    }

    public function test_unparseable_identity_payloads_are_skipped(): void
    {
        [$recipe] = $this->registerFixture('carbonaraRaw');

        // A fingerprint row whose identity payload is garbage — it matches
        // nothing on hashes but exists, so only identitiesFor() shows it
        // being skipped.
        $other = Recipe::create(['title' => 'Broken identity row', 'steps_count' => 1]);
        RecipeFingerprint::query()->create([
            'recipe_id' => $other->id,
            'version' => 1,
            'fingerprint' => 'fp-broken',
            'identity_signature' => 'sig-broken',
            'ingredient_combo_hash' => 'combo-broken',
            'main_ingredient_hash' => 'main-broken',
            'title_signature' => 'title-broken',
            'identity' => '{not json at all',
            'is_complete' => true,
        ]);

        $entries = $this->retriever()->identitiesForRecipes([(int) $recipe->id, (int) $other->id]);

        $this->assertSame([(int) $recipe->id], array_column($entries, 'id'));
        $this->assertSame('Spaghetti Carbonara', $entries[0]['title']);
    }

    public function test_provider_failure_is_fail_soft_and_structured_sources_survive(): void
    {
        [$registered] = $this->registerFixture('carbonaraRaw');

        $throwing = new class implements EmbeddingProvider
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
                throw new \RuntimeException('provider is down');
            }
        };

        $alt = $this->candidate('carbonaraAlternate');
        $altIdentity = $this->fingerprints->identity($alt);
        $altSet = $this->fingerprints->fingerprintSet($alt, $altIdentity);

        $retrieval = $this->retriever($throwing)->retrieve($alt, $altIdentity, $altSet);

        // Identity-signature retrieval is unharmed; the vector source simply
        // produced nothing (and no exception escaped).
        $this->assertSame([(int) $registered->id], array_column($retrieval->identities, 'id'));
        $this->assertSame('identity_signature', $retrieval->candidates[0]->meta['retrieval_source']);
        $this->assertNull($retrieval->vector);
    }

    public function test_vector_source_stays_off_when_the_store_is_disabled(): void
    {
        [$recipe, $row] = $this->registerFixture('foulMedames');
        (new EmbeddingService($this->provider, $this->store))
            ->ensureIndexedGivenIdentity($recipe, $this->fingerprints->deserializeIdentity($row->identity), $row);
        $foulIdentity = $this->fingerprints->deserializeIdentity($row->identity);
        $this->assertNotNull($foulIdentity);

        // Swap in the NULL store (enabled() = false): with a candidate that
        // can ONLY arrive through the vector source (all structured hashes
        // disjoint), the semantic source must not fire at all.
        $nullStore = new NullVectorStore;

        $retrieval = (new CandidateRetriever($this->fingerprints, $this->provider, $nullStore))
            ->retrieve($this->candidate('kupuraBeanStew'), $foulIdentity, self::disjointSet());

        $this->assertSame([], $retrieval->identities);
        $this->assertNull($retrieval->vector);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * The NULL-signal set: hashes that can never occur naturally, used to
     * isolate the vector source.
     */
    private static function disjointSet(): FingerprintSet
    {
        return new FingerprintSet(
            fingerprint: 'fp-isolated-0000',
            identitySignature: 'sig-isolated-0000',
            ingredientComboHash: 'combo-isolated-0000',
            mainIngredientHash: 'main-isolated-0000',
            titleSignature: 'title-isolated-0000',
            version: 1,
        );
    }

    /**
     * A semolina-dessert identity that shares ONLY the equality filter
     * keys with the ful medames identity (same dish_family + cuisine).
     */
    /**
     * Insert a fingerprint row with FULLY controlled hashes: exact /
     * identity_signature / main / title independently choosable.
     *
     * @param  array<string, string>  $overrides  column => value
     */
    private function craftFingerprintRow(
        Recipe $recipe,
        CandidateRecipe $candidate,
        array $overrides = [],
        bool $isComplete = true,
    ): RecipeFingerprint {
        $set = $this->fingerprints->fingerprintSet($candidate);

        /** @var RecipeFingerprint */
        return RecipeFingerprint::query()->create([
            'recipe_id' => $recipe->id,
            'version' => 1,
            'fingerprint' => $overrides['fingerprint'] ?? $set->fingerprint,
            'identity_signature' => $overrides['identity_signature'] ?? $set->identitySignature,
            'ingredient_combo_hash' => $overrides['ingredient_combo_hash'] ?? $set->ingredientComboHash,
            'main_ingredient_hash' => $overrides['main_ingredient_hash'] ?? $set->mainIngredientHash,
            'title_signature' => $overrides['title_signature'] ?? $set->titleSignature,
            'identity' => $this->fingerprints->identity($candidate)->toArray(),
            'is_complete' => $isComplete,
        ]);
    }
}
