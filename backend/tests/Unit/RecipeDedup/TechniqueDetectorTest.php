<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Fingerprinting\TechniqueDetector;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

final class TechniqueDetectorTest extends TestCase
{
    private TechniqueDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();

        $this->detector = new TechniqueDetector;
    }

    public function test_carbonara_fixture_yields_deterministic_sorted_techniques(): void
    {
        $steps = RecipeFixtures::carbonaraRaw()['steps'];

        $techniques = $this->detector->techniquesFromSteps($steps);

        $this->assertContains('boil', $techniques);
        $this->assertContains('saute', $techniques, 'rendering guanciale in a skillet is saute');
        $this->assertSame($techniques, $this->detector->techniquesFromSteps($steps));
        $this->assertSame($techniques, array_values(array_unique($techniques)));
        $this->assertSame($techniques, (function () use ($steps) {
            $copy = $steps;
            shuffle($copy);

            return $this->detector->techniquesFromSteps(array_values($copy));
        })(), 'step order must not change the sorted technique set');
    }

    public function test_alfredo_fixture_contains_whisk_or_saute(): void
    {
        $techniques = $this->detector->techniquesFromSteps(RecipeFixtures::chickenAlfredoClassic()['steps']);

        $this->assertTrue(
            in_array('whisk', $techniques, true) || in_array('saute', $techniques, true),
            'expected whisk or saute, got: '.implode(',', $techniques)
        );
        $this->assertContains('grill', $techniques);
    }

    public function test_cooking_method_follows_dominance_priority(): void
    {
        $this->assertSame('deep_fry', $this->detector->cookingMethodFrom(['saute', 'deep_fry']));
        $this->assertSame('bake', $this->detector->cookingMethodFrom(['simmer', 'bake']));
        $this->assertSame('roast', $this->detector->cookingMethodFrom(['bake', 'roast']));
        $this->assertSame('saute', $this->detector->cookingMethodFrom(['simmer', 'saute']));
    }

    public function test_no_heat_techniques_yield_null_cooking_method(): void
    {
        $this->assertNull($this->detector->cookingMethodFrom(['whisk', 'chill']));
        $this->assertNull($this->detector->cookingMethodFrom([]));
    }

    public function test_prep_method_mapping(): void
    {
        $this->assertSame('blended', $this->detector->prepMethodFrom(['blend']));
        $this->assertSame('kneaded', $this->detector->prepMethodFrom(['knead']));
        $this->assertSame('marinated', $this->detector->prepMethodFrom(['marinate']));
        $this->assertNull($this->detector->prepMethodFrom(['simmer']));
        $this->assertNull($this->detector->prepMethodFrom([]));
    }

    public function test_carbonara_is_never_classified_as_cream_based(): void
    {
        $draft = RecipeFixtures::carbonaraRaw();
        $sauces = $this->detector->saucesFrom($draft['title'], $draft['ingredients'], $draft['steps']);

        $this->assertNotContains('cream_based', $sauces, 'carbonara is an egg+cheese emulsion, not cream');
        $this->assertSame([], $sauces);
    }

    public function test_pesto_detected_from_basil_and_pine_nuts(): void
    {
        $sauces = $this->detector->saucesFrom(
            'Best pesto pasta',
            ['basil', 'pine nuts', 'parmesan cheese', 'olive oil', 'garlic'],
            ['Blend everything until smooth.']
        );

        $this->assertContains('pesto', $sauces);
        $this->assertNotContains('cream_based', $sauces);
    }

    public function test_tomato_sauce_detected_from_tomatoes_and_passata(): void
    {
        $sauces = $this->detector->saucesFrom(
            'Quick marinara',
            ['tomatoes', 'passata', 'garlic', 'olive oil'],
            ['Simmer the sauce for 20 minutes.']
        );

        $this->assertContains('tomato', $sauces);
        $this->assertNotContains('cream_based', $sauces);
    }

    public function test_pasta_form_detection(): void
    {
        $this->assertSame('spaghetti', $this->detector->formFrom('Spaghetti Carbonara', ['spaghetti'], 'pasta'));
        $this->assertSame('fettuccine', $this->detector->formFrom('Chicken Alfredo Fettuccine', ['fettuccine'], 'pasta'));
        $this->assertSame('penne', $this->detector->formFrom('penne arrabbiata', [], 'pasta'));
        $this->assertSame('lasagna', $this->detector->formFrom('lasagna bolognese', [], 'pasta'));
    }

    public function test_non_pasta_form_detection(): void
    {
        $this->assertSame('rice', $this->detector->formFrom('Rice Pudding', ['rice'], 'dessert'));
        $this->assertSame('bowl', $this->detector->formFrom('breakfast bowl', ['oats'], null));
        $this->assertNull($this->detector->formFrom('mystery plate of joy', ['vibes'], null));
    }
}
