<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Fingerprinting\IngredientNormalizer;
use Tests\TestCase;

final class IngredientNormalizerTest extends TestCase
{
    private IngredientNormalizer $normalizer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->normalizer = new IngredientNormalizer;
    }

    public function test_parmesan_spellings_converge_on_one_name(): void
    {
        $names = $this->normalizer->namesOnly($this->normalizer->set([
            '50 g parmesan, grated',
            '30 g parmigiano reggiano',
            '20 g Parmigiano-Reggiano',
        ]));

        $this->assertSame(['parmesan cheese', 'parmesan cheese', 'parmesan cheese'], $names);
    }

    public function test_extra_virgin_olive_oil_equals_olive_oil(): void
    {
        $names = $this->normalizer->namesOnly($this->normalizer->set([
            '2 tbsp extra virgin olive oil',
            '1 tsp EVOO',
            '1 tsp olive oil',
        ]));

        $this->assertSame(['olive oil', 'olive oil', 'olive oil'], $names);
    }

    public function test_greek_yogurt_is_never_merged_with_plain_yogurt(): void
    {
        $names = $this->normalizer->namesOnly($this->normalizer->set([
            '1 cup greek yogurt',
            '1 cup plain yogurt',
        ]));

        $this->assertSame(['greek yogurt', 'plain yogurt'], $names);
        $this->assertNotSame($names[0], $names[1]);
    }

    public function test_chicken_breast_variants_equal_chicken_breast(): void
    {
        $names = $this->normalizer->namesOnly($this->normalizer->set([
            '600 g chicken breast meat, sliced',
            '2 chicken breasts',
            '1 chicken breast fillet',
        ]));

        $this->assertSame(['chicken breast', 'chicken breast', 'chicken breast'], $names);
    }

    public function test_volume_conversion_two_cups_is_480_ml(): void
    {
        $item = $this->normalizer->normalize('2 cups brown sugar');

        $this->assertSame('brown sugar', $item['item']);
        $this->assertSame(480.0, $item['qty']);
        $this->assertSame('ml', $item['unit']);
    }

    public function test_tablespoon_is_15_ml(): void
    {
        $item = $this->normalizer->normalize('1 tbsp olive oil');

        $this->assertSame('olive oil', $item['item']);
        $this->assertSame(15.0, $item['qty']);
        $this->assertSame('ml', $item['unit']);
    }

    public function test_pound_is_454_grams(): void
    {
        $item = $this->normalizer->normalize('1 lb potatoes');

        $this->assertSame('potato', $item['item']);
        $this->assertSame(454.0, $item['qty']);
        $this->assertSame('gram', $item['unit']);
    }

    public function test_unicode_vulgar_fractions_are_parsed(): void
    {
        $half = $this->normalizer->normalize('½ tsp salt');
        $this->assertSame(2.5, $half['qty']);
        $this->assertSame('ml', $half['unit']);

        $quarter = $this->normalizer->normalize('¼ cup olive oil');
        $this->assertSame(60.0, $quarter['qty']);
        $this->assertSame('ml', $quarter['unit']);
    }

    public function test_mixed_numbers_are_parsed(): void
    {
        $item = $this->normalizer->normalize('1 1/2 cups flour');

        $this->assertSame('flour', $item['item']);
        $this->assertSame(360.0, $item['qty']);
        $this->assertSame('ml', $item['unit']);
    }

    public function test_to_taste_yields_null_quantity(): void
    {
        $item = $this->normalizer->normalize('salt to taste');

        $this->assertSame('salt', $item['item']);
        $this->assertNull($item['qty']);
        $this->assertNull($item['unit']);
    }

    public function test_leading_descriptors_are_stripped_variety_words_survive(): void
    {
        $fresh = $this->normalizer->normalize('2 cups fresh strawberries');
        $this->assertSame('strawberry', $fresh['item']);

        $black = $this->normalizer->normalize('1 tsp black pepper');
        $this->assertSame('black pepper', $black['item'], 'variety word "black" must survive');
    }

    public function test_singularization_with_irregulars(): void
    {
        $names = $this->normalizer->namesOnly($this->normalizer->set([
            '4 tomatoes',
            '3 potatoes',
            '2 cups berries',
            '5 curry leaves',
            '2 chilies',
        ]));

        $this->assertSame(['tomato', 'potato', 'berry', 'curry leaf', 'chili'], $names);
    }

    public function test_structured_items_are_normalized_and_raw_fallback_works(): void
    {
        $structured = $this->normalizer->normalizeStructuredItem([
            'item' => 'cherry tomatoes',
            'qty' => 200,
            'unit' => 'g',
            'raw' => null,
            'prep' => null,
        ]);

        $this->assertSame('cherry tomato', $structured['item']);
        $this->assertSame(200.0, $structured['qty']);
        $this->assertSame('gram', $structured['unit']);

        $fallback = $this->normalizer->normalizeStructuredItem([
            'item' => '',
            'qty' => null,
            'unit' => null,
            'raw' => '2 cups rice',
            'prep' => null,
        ]);

        $this->assertSame('rice', $fallback['item']);
        $this->assertSame(480.0, $fallback['qty']);
    }

    public function test_arabic_line_passes_through_without_crashing(): void
    {
        $item = $this->normalizer->normalize('سيطة أرز ٢ كوب');

        $this->assertNotSame('', $item['item']);
        $this->assertNull($item['qty']);
        $this->assertTrue(mb_check_encoding($item['item'], 'UTF-8'));
        $this->assertTrue(mb_check_encoding($item['raw'], 'UTF-8'));
    }
}
