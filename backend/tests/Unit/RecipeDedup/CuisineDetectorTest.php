<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Fingerprinting\CuisineDetector;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class CuisineDetectorTest extends TestCase
{
    private CuisineDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();

        $this->detector = new CuisineDetector;
    }

    public function test_explicit_hint_always_wins(): void
    {
        $candidate = CandidateRecipe::fromDraft([
            'title' => 'Spaghetti Carbonara',
            'ingredients' => ['spaghetti', 'egg', 'pecorino'],
            'steps' => ['boil pasta'],
            'cuisine' => 'thai',
        ]);

        $this->assertSame('thai', $this->detector->detectCuisine($candidate, null));
    }

    public function test_dish_keywords_resolve_to_italian(): void
    {
        $candidate = CandidateRecipe::fromDraft([
            'title' => 'Spaghetti Carbonara',
            'ingredients' => ['spaghetti', 'guanciale', 'egg', 'pecorino'],
            'steps' => ['boil pasta'],
        ]);

        $this->assertSame('italian', $this->detector->detectCuisine($candidate, null));
    }

    public function test_ful_medames_fixture_resolves_to_egyptian(): void
    {
        $draft = RecipeFixtures::foulMedames();

        // With the fixture's own hint:
        $this->assertSame('egyptian', $this->detector->detectCuisine(
            CandidateRecipe::fromDraft($draft),
            null
        ));

        // And still egyptian WITHOUT the explicit hint — the fava beans +
        // ful evidence in title/ingredients carries it.
        unset($draft['cuisine']);
        $this->assertSame('egyptian', $this->detector->detectCuisine(
            CandidateRecipe::fromDraft($draft),
            null
        ));
    }

    public function test_unsure_input_returns_null_instead_of_guessing(): void
    {
        $candidate = CandidateRecipe::fromDraft([
            'title' => 'grandma kitchen surprise',
            'ingredients' => ['chicken', 'rice'],
            'steps' => ['cook it'],
        ]);

        $this->assertNull($this->detector->detectCuisine($candidate, null));
    }

    public function test_signature_ingredient_heuristic_guanciale_plus_pecorino(): void
    {
        $candidate = CandidateRecipe::fromDraft([
            'title' => 'mystery dinner',
            'ingredients' => ['guanciale', 'pecorino cheese', 'spaghetti'],
            'steps' => ['boil pasta', 'toss'],
        ]);

        $this->assertSame('italian', $this->detector->detectCuisine($candidate, null));
    }

    public function test_dish_family_from_category_title_and_ingredients(): void
    {
        $this->assertSame('pasta', $this->detector->dishFamilyFrom(null, 'Chicken Alfredo Fettuccine', ['fettuccine', 'chicken breast']));
        $this->assertSame('breakfast', $this->detector->dishFamilyFrom('Breakfast', 'ful medames', []));
        $this->assertSame('pasta', $this->detector->dishFamilyFrom('Pasta', 'weird nonsense title', []));
    }
}
