<?php

namespace Tests\Feature\RecipeDedup;

use App\Models\Recipe;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Fingerprinting\FingerprintCollisionException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class FingerprintServiceTest extends TestCase
{
    use RefreshDatabase;

    private FingerprintService $service;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new FingerprintService;
    }

    private function createRecipe(string $fixture): Recipe
    {
        $draft = RecipeFixtures::{$fixture}();

        return Recipe::create([
            'title' => $draft['title'],
            'ingredients' => $draft['ingredients'],
            'steps' => $draft['steps'],
            'keywords' => $draft['keywords'] ?? [],
            'category' => (string) ($draft['category'] ?? 'Dinner'),
            'steps_count' => count($draft['steps']),
        ]);
    }

    public function test_register_is_idempotent_one_row_per_recipe(): void
    {
        $recipe = $this->createRecipe('carbonaraRaw');

        $first = $this->service->register($recipe);
        $second = $this->service->register($recipe->id);

        $this->assertSame($first->id, $second->id);
        $this->assertSame($first->fingerprint, $second->fingerprint);
        $this->assertSame(1, DB::table('recipe_fingerprints')->count());
    }

    public function test_denormalized_columns_and_payload_are_populated(): void
    {
        $recipe = $this->createRecipe('carbonaraRaw');
        $row = $this->service->register($recipe);

        $this->assertSame('pasta', $row->dish_family);
        $this->assertSame('italian', $row->cuisine);
        $this->assertSame('spaghetti', $row->form);
        $this->assertNull($row->sauce, 'carbonara has no sauce');
        $this->assertTrue($row->is_complete);
        $this->assertSame(1, $row->version);
        $this->assertSame('Pasta', $row->category);

        $identity = $row->identity;
        $this->assertSame('spaghetti carbonara', $identity['canonical_dish']);
        $this->assertSame('pasta', $identity['dish_family']);
        $this->assertSame('italian', $identity['cuisine']);
        $this->assertSame('spaghetti', $identity['form']);
        $this->assertNotEmpty($identity['main_ingredients']);
        $this->assertNotEmpty($identity['supporting_ingredients']);

        // Hash columns mirror the built FingerprintSet.
        $set = $this->service->fingerprintSet(CandidateRecipe::fromRecipe($recipe));
        $this->assertSame($set->fingerprint, $row->fingerprint);
        $this->assertSame($set->identitySignature, $row->identity_signature);
        $this->assertSame($set->ingredientComboHash, $row->ingredient_combo_hash);
        $this->assertSame($set->mainIngredientHash, $row->main_ingredient_hash);
        $this->assertSame($set->titleSignature, $row->title_signature);
    }

    public function test_identity_round_trips_on_of(): void
    {
        $recipe = $this->createRecipe('carbonaraRaw');
        $this->service->register($recipe);

        $identity = $this->service->identityOf($recipe->id);

        $this->assertNotNull($identity);
        $this->assertSame($this->service->identity(CandidateRecipe::fromRecipe($recipe))->toArray(), $identity->toArray());
        $this->assertSame('spaghetti carbonara', $identity->canonicalDish);
    }

    public function test_incomplete_recipe_is_marked_not_complete(): void
    {
        // "recipe" alone is stripped by the title cleaner -> no canonical
        // dish; empty ingredients + steps -> degraded fingerprint row.
        $recipe = Recipe::create(['title' => 'Recipe']);

        $row = $this->service->register($recipe);

        $this->assertFalse($row->is_complete);
        $this->assertSame('', $row->identity['canonical_dish']);
        $this->assertNull($row->dish_family);
    }

    public function test_for_recipe_returns_null_for_unregistered_recipes(): void
    {
        $recipe = $this->createRecipe('carbonaraRaw');

        $this->assertNull($this->service->forRecipe($recipe));
        $this->assertNull($this->service->forRecipe($recipe->id));
        $this->assertNull($this->service->identityOf($recipe));
    }

    public function test_register_throws_collision_when_another_recipe_holds_the_fingerprint(): void
    {
        // Recipe A registered first — it now holds the exact carbonara
        // fingerprint in the UNIQUE(fingerprint) column.
        $a = $this->createRecipe('carbonaraRaw');
        $this->service->register($a);
        $fingerprintOfA = $this->service->forRecipe($a)->fingerprint;

        // Recipe B is the SAME dish entered through a different row — its
        // computed fingerprint equals A's, so the INSERT violates the
        // unique index and must surface as FingerprintCollisionException.
        $b = $this->createRecipe('carbonaraRaw');
        $this->assertNotSame($a->id, $b->id);

        try {
            $this->service->register($b);
            $this->fail('expected FingerprintCollisionException');
        } catch (FingerprintCollisionException $e) {
            $this->assertNotNull($e->getPrevious());
            $this->assertStringContainsString('fingerprint', strtolower($e->getPrevious()->getMessage()));
        }

        // Recipe B is still unregistered; nothing was written for it.
        $this->assertNull($this->service->forRecipe($b));
        $this->assertSame($fingerprintOfA, $this->service->forRecipe($a)->fingerprint);
        $this->assertSame(1, DB::table('recipe_fingerprints')->count());
    }

    public function test_deserialize_identity_never_throws(): void
    {
        $recipe = $this->createRecipe('carbonaraRaw');
        $row = $this->service->register($recipe);

        $this->assertNull($this->service->deserializeIdentity(null));
        $this->assertNull($this->service->deserializeIdentity(''));
        $this->assertNull($this->service->deserializeIdentity('not json at all'));
        $this->assertNull($this->service->deserializeIdentity('{}'));

        $fromString = $this->service->deserializeIdentity(json_encode($row->identity));
        $fromArray = $this->service->deserializeIdentity($row->identity);

        $this->assertNotNull($fromString);
        $this->assertNotNull($fromArray);
        $this->assertSame($fromArray->toArray(), $fromString->toArray());
        $this->assertSame('spaghetti carbonara', $fromString->canonicalDish);
    }
}
