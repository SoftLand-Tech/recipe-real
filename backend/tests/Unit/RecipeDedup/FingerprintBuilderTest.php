<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Fingerprinting\CulinaryIdentityExtractor;
use App\Services\RecipeDedup\Fingerprinting\FingerprintBuilder;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class FingerprintBuilderTest extends TestCase
{
    private FingerprintBuilder $builder;

    protected function setUp(): void
    {
        parent::setUp();

        $this->builder = new FingerprintBuilder(new CulinaryIdentityExtractor);
    }

    private function candidate(string $fixture, ?callable $mutate = null): CandidateRecipe
    {
        $draft = RecipeFixtures::{$fixture}();

        if ($mutate !== null) {
            $draft = $mutate($draft);
        }

        return CandidateRecipe::fromDraft($draft);
    }

    public function test_same_input_builds_identical_hashes_twice(): void
    {
        $first = $this->builder->build($this->candidate('carbonaraRaw'));
        $second = $this->builder->build($this->candidate('carbonaraRaw'));

        $this->assertSame($first->fingerprint, $second->fingerprint);
        $this->assertSame($first->identitySignature, $second->identitySignature);
        $this->assertSame($first->ingredientComboHash, $second->ingredientComboHash);
        $this->assertSame($first->mainIngredientHash, $second->mainIngredientHash);
        $this->assertSame($first->titleSignature, $second->titleSignature);
    }

    public function test_ingredient_order_permutation_does_not_change_any_hash(): void
    {
        $base = $this->candidate('carbonaraRaw');
        $reordered = $this->candidate('carbonaraRaw', fn (array $draft): array => [
            ...$draft,
            'ingredients' => array_reverse($draft['ingredients']),
            'steps' => array_reverse($draft['steps']),
        ]);

        $a = $this->builder->build($base);
        $b = $this->builder->build($reordered);

        $this->assertSame($a->fingerprint, $b->fingerprint);
        $this->assertSame($a->identitySignature, $b->identitySignature);
        $this->assertSame($a->ingredientComboHash, $b->ingredientComboHash);
    }

    public function test_carbonara_and_paraphrased_alternate_share_identity_signature(): void
    {
        $a = $this->builder->build($this->candidate('carbonaraRaw'));
        $b = $this->builder->build($this->candidate('carbonaraAlternate'));

        // "Spaghetti Carbonara" vs "Authentic Roman Style Pasta with Egg
        // and Cured Pork" is the SAME dish after extraction.
        $this->assertSame($a->identitySignature, $b->identitySignature);
        $this->assertSame($a->mainIngredientHash, $b->mainIngredientHash);

        // ...but quantities differ (400g vs 450g spaghetti etc.) so the
        // full fingerprints must differ, as must every title-derived value.
        $this->assertNotSame($a->fingerprint, $b->fingerprint);
        $this->assertNotSame($a->ingredientComboHash, $b->ingredientComboHash);
        $this->assertNotSame($a->titleSignature, $b->titleSignature);
    }

    public function test_different_ingredients_produce_different_fingerprints(): void
    {
        $a = $this->builder->build($this->candidate('carbonaraRaw'));
        $b = $this->builder->build($this->candidate('carbonaraRaw', fn (array $draft): array => [
            ...$draft,
            'ingredients' => array_values(array_filter(
                $draft['ingredients'],
                fn (string $line): bool => ! str_contains($line, 'pepper')
            )),
        ]));

        $this->assertNotSame($a->fingerprint, $b->fingerprint);
        $this->assertNotSame($a->ingredientComboHash, $b->ingredientComboHash);
        // One supporting ingredient dropped — mains unchanged.
        $this->assertSame($a->mainIngredientHash, $b->mainIngredientHash);
    }

    public function test_quantity_binning_boundaries(): void
    {
        $this->assertNull(FingerprintBuilder::binQuantity(null));
        $this->assertSame(2.0, FingerprintBuilder::binQuantity(2.0));
        $this->assertSame(2.5, FingerprintBuilder::binQuantity(2.4));
        $this->assertSame(2.5, FingerprintBuilder::binQuantity(2.6));
        $this->assertSame(3.0, FingerprintBuilder::binQuantity(2.9));
        $this->assertSame(8.0, FingerprintBuilder::binQuantity(7.6));
        $this->assertSame(80.0, FingerprintBuilder::binQuantity(80.0));
        $this->assertSame(85.0, FingerprintBuilder::binQuantity(86.0));
        $this->assertSame(100.0, FingerprintBuilder::binQuantity(100.0));
        $this->assertSame(125.0, FingerprintBuilder::binQuantity(124.0));
    }

    public function test_pecorino_80g_vs_100g_same_identity_different_fingerprint(): void
    {
        $small = $this->builder->build($this->candidate('carbonaraRaw', function (array $draft): array {
            $draft['ingredients'] = str_replace(
                '100 g Pecorino Romano, finely grated',
                '80 g Pecorino Romano, finely grated',
                $draft['ingredients']
            );

            return $draft;
        }));
        $large = $this->builder->build($this->candidate('carbonaraRaw'));

        $this->assertNotSame($small->fingerprint, $large->fingerprint, '80g vs 100g bin differently');
        $this->assertSame($small->identitySignature, $large->identitySignature, 'quantities excluded from identity');
    }

    public function test_spicy_and_classic_alfredo_differ_on_identity_signature(): void
    {
        $classic = $this->builder->build($this->candidate('chickenAlfredoClassic'));
        $spicy = $this->builder->build($this->candidate('chickenAlfredoSpicy'));

        $this->assertNotSame($classic->identitySignature, $spicy->identitySignature);
        $this->assertSame($classic->mainIngredientHash, $spicy->mainIngredientHash);
        $this->assertNotSame($classic->fingerprint, $spicy->fingerprint);
    }

    public function test_title_signature_is_case_and_punctuation_insensitive_but_distinct(): void
    {
        $a = $this->builder->build($this->candidate('carbonaraRaw'));
        $b = $this->builder->build($this->candidate('carbonaraRaw', fn (array $draft): array => [
            ...$draft,
            'title' => 'SPAGHETTI carbonara!!',
        ]));
        $c = $this->builder->build($this->candidate('chickenAlfredoClassic'));

        $this->assertSame($a->titleSignature, $b->titleSignature);
        $this->assertNotSame($a->titleSignature, $c->titleSignature);
    }

    public function test_version_is_at_least_one(): void
    {
        $this->assertGreaterThanOrEqual(1, $this->builder->build($this->candidate('carbonaraRaw'))->version);
    }
}
