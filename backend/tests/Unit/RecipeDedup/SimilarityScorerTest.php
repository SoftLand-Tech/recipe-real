<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Detection\SimilarityScorer;
use Tests\Support\FakeEmbeddingProvider;
use Tests\TestCase;

/**
 * Pure unit tests of the weighted scorer (no DB). The identity fixtures
 * here are handcrafted to isolate one behavior per test; the realistic
 * cross-fixture behavior (carbonara pair, alfredo pair) is pinned by the
 * feature suites (DuplicateDetectionServiceTest).
 */
final class SimilarityScorerTest extends TestCase
{
    private SimilarityScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->scorer = new SimilarityScorer;
    }

    public function test_identical_identities_score_one_with_all_pillars(): void
    {
        $identity = self::carbonaraIdentity();

        $score = $this->scorer->score($identity, $identity);

        $this->assertSame(1.0, $score->total);
        $this->assertSame(4, $score->corroborations); // family + mains + techniques + canonical
        $this->assertTrue($score->passesCorroboration);
    }

    public function test_identical_identities_without_vectors_still_score_one(): void
    {
        // No vectors at all: vector_cosine is EXCLUDED (not zeroed), so the
        // weighted mean renormalizes over the structural features only and
        // identical identities still land on exactly 1.0.
        $identity = self::carbonaraIdentity();

        $score = $this->scorer->score($identity, $identity, null, null);

        $this->assertSame(1.0, $score->total);
        $this->assertArrayNotHasKey('vector_cosine', $score->features);
    }

    public function test_missing_vector_is_excluded_not_zeroed(): void
    {
        $a = self::alfredoIdentity();
        $b = self::alfredoIdentity(spicy: false);

        $withoutVector = $this->scorer->score($a, $b);
        // Same identities, but the compared vectors are (near) orthogonal —
        // a zeroed feature would deflate the total below the vector-less
        // one; exclusion must keep the vector-less total HIGHER.
        $withOrthogonal = $this->scorer->score(
            $a,
            $b,
            FakeEmbeddingProvider::vectorize('totally different pizza dough words'),
            FakeEmbeddingProvider::vectorize('other unrelated soup simmer words'),
        );

        $this->assertGreaterThan(0.0, $withoutVector->total);
        $this->assertGreaterThan($withOrthogonal->total, $withoutVector->total);
    }

    public function test_high_similarity_vector_presence_uses_actual_cosine(): void
    {
        $a = self::carbonaraIdentity();
        $b = self::carbonaraIdentity();

        $text = 'spaghetti carbonara eggs pecorino guanciale pasta';
        $score = $this->scorer->score(
            $a,
            $b,
            FakeEmbeddingProvider::vectorize($text),
            FakeEmbeddingProvider::vectorize($text.' pasta water pepper'),
        );

        // Identical texts would be 1.0; the extra tokens dilute the cosine a
        // little but it must stay high (top-3 explanation names it).
        $this->assertGreaterThan(0.9, $score->features['vector_cosine']);
        $this->assertGreaterThan(0.9, $score->total);
        $this->assertNotSame(1.0, $score->total);
    }

    public function test_alfredo_classic_vs_spicy_is_high_but_below_one(): void
    {
        $classic = self::alfredoIdentity();
        $spicy = self::alfredoIdentity(spicy: true);

        $score = $this->scorer->score($classic, $spicy);

        // Same dish family, identical mains, same canonical dish, mostly
        // same techniques — high. But the supporting deltas (cajun, cayenne
        // replacing garlic/parsley/cream-share changes) keep it strictly
        // below identical. NOTE: flavor markers carry no weight — the delta
        // is ingredient-driven by design.
        $this->assertGreaterThanOrEqual(0.7, $score->total);
        $this->assertLessThan(1.0, $score->total);
        $this->assertTrue($score->passesCorroboration, 'same family + same mains must corroborate');
    }

    public function test_unrelated_identities_score_low(): void
    {
        $carbonara = self::carbonaraIdentity();
        $foul = self::foulIdentity();

        $score = $this->scorer->score($carbonara, $foul);

        $this->assertLessThan(0.2, $score->total);
        $this->assertFalse($score->passesCorroboration);
    }

    public function test_corroboration_counts_only_satisfied_pillars(): void
    {
        // Same family, mains overlap exactly at the threshold (0.7), no
        // techniques shared field, different canonical dishes.
        $a = new CulinaryIdentity(
            canonicalDish: 'stew a',
            dishFamily: 'stew',
            cuisine: 'levantine',
            category: 'Dinner',
            form: 'soup',
            mainIngredients: self::items(['fava beans', 'garlic', 'olive oil']),
            supportingIngredients: self::items(['cumin']),
            techniques: ['simmer'],
            cookingMethod: 'stovetop',
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );
        $b = new CulinaryIdentity(
            canonicalDish: 'stew b',
            dishFamily: 'stew',
            cuisine: 'egyptian',
            category: 'Dinner',
            form: 'soup',
            mainIngredients: self::items(['fava beans', 'garlic', 'tomatoes']),
            supportingIngredients: self::items(['cumin']),
            techniques: ['boil'],
            cookingMethod: 'stovetop',
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );

        $score = $this->scorer->score($a, $b);

        // mains Jaccard = |{fava beans, garlic}| / |{fava beans, garlic, olive oil, tomatoes}| = 2/4 = 0.5 → below 0.7,
        // techniques 0 → pillars: family only.
        $this->assertSame(1, $score->corroborations);
        $this->assertFalse($score->passesCorroboration);
    }

    public function test_corroboration_passes_at_min_rules_via_mains_and_family(): void
    {
        // Family same + mains Jaccard exactly 0.7 (7/10) → 2 pillars → passes.
        $a = new CulinaryIdentity(
            canonicalDish: 'vegetable stew',
            dishFamily: 'stew',
            cuisine: 'levantine',
            category: 'Dinner',
            form: 'stew',
            mainIngredients: self::items(['fava beans', 'garlic', 'olive oil', 'onion', 'carrots', 'tomatoes', 'cumin']),
            supportingIngredients: self::items(['paprika']),
            techniques: ['simmer', 'saute'],
            cookingMethod: 'stovetop',
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );
        // mains: 7 shared of 10 union → 0.7 exactly.
        $b = new CulinaryIdentity(
            canonicalDish: 'another stew',
            dishFamily: 'stew',
            cuisine: 'egyptian',
            category: 'Dinner',
            form: 'stew',
            mainIngredients: self::items(['fava beans', 'garlic', 'olive oil', 'onion', 'carrots', 'tomatoes', 'cumin', 'stock', 'potato', 'lemon']),
            supportingIngredients: self::items(['paprika']),
            techniques: ['bake'],
            cookingMethod: 'oven',
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );

        $score = $this->scorer->score($a, $b);

        $this->assertSame(2, $score->corroborations);
        $this->assertTrue($score->passesCorroboration);
    }

    public function test_weight_config_is_respected(): void
    {
        $a = self::alfredoIdentity();
        $b = self::alfredoIdentity(spicy: true);

        $baseline = $this->scorer->score($a, $b)->total;

        // Nuke every weight except same_canonical_dish (which is 1 for this
        // pair): the total must become exactly the weighted mean of the
        // remaining features — i.e. fully driven by config.
        config(['recipe_dedup.weights' => ['main_ingredients_jaccard' => 1]]);

        $mainsOnly = $this->scorer->score($a, $b);

        $this->assertSame(1.0, $mainsOnly->features['main_ingredients_jaccard']);
        $this->assertSame(1.0, $mainsOnly->total);
        $this->assertNotSame($baseline, $mainsOnly->total);
    }

    public function test_all_features_missing_scores_zero_without_dividing_by_zero(): void
    {
        $empty = new CulinaryIdentity(
            canonicalDish: '',
            dishFamily: null,
            cuisine: null,
            category: null,
            form: null,
            mainIngredients: [],
            supportingIngredients: [],
            techniques: [],
            cookingMethod: null,
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );

        $score = $this->scorer->score($empty, $empty);

        $this->assertSame(0.0, $score->total);
        $this->assertSame([], $score->features);
        $this->assertSame(0, $score->corroborations);
        $this->assertFalse($score->passesCorroboration);
    }

    public function test_one_sided_empty_ingredients_count_as_zero_overlap(): void
    {
        $full = self::carbonaraIdentity();
        $empty = new CulinaryIdentity(
            canonicalDish: 'another pasta',
            dishFamily: 'pasta',
            cuisine: 'italian',
            category: 'Dinner',
            form: 'pasta',
            mainIngredients: [],
            supportingIngredients: [],
            techniques: ['boil'],
            cookingMethod: 'stovetop',
            prepMethod: null,
            sauces: [],
            flavorMarkers: [],
            characteristics: [],
        );

        $score = $this->scorer->score($full, $empty);

        // One-sided Jaccard is 0.0 AND PRESENT (not excluded) — the
        // candidate clearly fails the shared-ingredient pillar.
        $this->assertSame(0.0, $score->features['main_ingredients_jaccard']);
        $this->assertSame(0.0, $score->features['all_ingredients_jaccard']);
        $this->assertLessThan(0.5, $score->total);
    }

    // ------------------------------------------------------------------
    // Identity fixtures
    // ------------------------------------------------------------------

    /** @param list<string> $names */
    private static function items(array $names): array
    {
        return array_map(
            static fn (string $name): array => ['item' => $name, 'qty' => null, 'unit' => null, 'raw' => null],
            $names,
        );
    }

    private static function carbonaraIdentity(): CulinaryIdentity
    {
        return new CulinaryIdentity(
            canonicalDish: 'spaghetti carbonara',
            dishFamily: 'pasta',
            cuisine: 'italian',
            category: 'Pasta',
            form: 'spaghetti',
            mainIngredients: self::items(['spaghetti', 'guanciale', 'egg yolks', 'pecorino']),
            supportingIngredients: self::items(['black pepper', 'salt']),
            techniques: ['boil', 'render', 'whisk', 'toss'],
            cookingMethod: 'stovetop',
            prepMethod: 'boil',
            sauces: ['egg sauce'],
            flavorMarkers: ['peppery', 'salty'],
            characteristics: ['creamy', 'no cream'],
        );
    }

    private static function alfredoIdentity(bool $spicy = false): CulinaryIdentity
    {
        $supporting = $spicy
            ? self::items(['cajun seasoning', 'cayenne pepper', 'garlic'])
            : self::items(['garlic', 'olive oil', 'parsley']);

        return new CulinaryIdentity(
            canonicalDish: 'chicken alfredo',
            dishFamily: 'pasta',
            cuisine: 'italian-american',
            category: 'Pasta',
            form: 'fettuccine',
            mainIngredients: self::items(['fettuccine', 'chicken breast', 'heavy cream', 'parmesan']),
            supportingIngredients: $supporting,
            techniques: $spicy ? ['boil', 'sear', 'simmer', 'whisk'] : ['boil', 'grill', 'simmer', 'whisk'],
            cookingMethod: 'stovetop',
            prepMethod: 'boil',
            sauces: $spicy ? ['alfredo sauce', 'spiced cream'] : ['alfredo sauce'],
            flavorMarkers: $spicy ? ['spicy', 'savory'] : ['rich', 'creamy'],
            characteristics: ['creamy'],
        );
    }

    private static function foulIdentity(): CulinaryIdentity
    {
        return new CulinaryIdentity(
            canonicalDish: 'ful medames',
            dishFamily: 'dips',
            cuisine: 'egyptian',
            category: 'Breakfast',
            form: 'mashed',
            mainIngredients: self::items(['fava beans', 'olive oil', 'lemon']),
            supportingIngredients: self::items(['garlic', 'cumin', 'parsley', 'tomato']),
            techniques: ['simmer', 'mash'],
            cookingMethod: 'stovetop',
            prepMethod: 'simmer',
            sauces: [],
            flavorMarkers: ['tangy'],
            characteristics: ['vegan'],
        );
    }
}
