<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Embeddings\EmbeddingTextBuilder;
use Tests\TestCase;

class EmbeddingTextBuilderTest extends TestCase
{
    public function test_same_identity_builds_byte_identical_text(): void
    {
        $text = EmbeddingTextBuilder::build($this->identity());
        $again = EmbeddingTextBuilder::build($this->identity());

        $this->assertSame($text, $again);
        $this->assertSame(hash('sha256', $text), hash('sha256', $again));
    }

    public function test_quantities_do_not_change_the_text(): void
    {
        // The 80g-vs-100g pecorino rule: only qty/unit/raw differ, so the
        // embedding text — and therefore the signature hash — must match.
        $lighter = $this->identity([
            'mainIngredients' => [
                ['item' => 'spaghetti', 'qty' => 400.0, 'unit' => 'gram', 'raw' => '400 g spaghetti'],
                ['item' => 'guanciale', 'qty' => 120.0, 'unit' => 'gram', 'raw' => '120 g guanciale'],
                ['item' => 'egg', 'qty' => 4.0, 'unit' => 'count', 'raw' => '4 egg yolks'],
            ],
            'supportingIngredients' => [
                ['item' => 'pecorino cheese', 'qty' => 80.0, 'unit' => 'gram', 'raw' => '80 g Pecorino'],
                ['item' => 'black pepper', 'qty' => 1.0, 'unit' => null, 'raw' => '1 tsp black pepper'],
            ],
        ]);

        $this->assertSame(
            EmbeddingTextBuilder::build($this->identity()),
            EmbeddingTextBuilder::build($lighter),
        );
        $this->assertDoesNotMatchRegularExpression('/\b\d+(\.\d+)?\s*(g|gram|ml|kg|tbsp|tsp|cups?|count)\b/i', EmbeddingTextBuilder::build($lighter));
    }

    public function test_arabic_identity_is_utf8_safe_without_mojibake(): void
    {
        $text = EmbeddingTextBuilder::build($this->identity([
            'canonicalDish' => 'ملوخية بالفراخ',
            'dishFamily' => 'main_dish',
        ]));

        $this->assertTrue(mb_check_encoding($text, 'UTF-8'));
        $this->assertStringContainsString('Dish: ملوخية بالفراخ.', $text);
        $this->assertStringNotContainsString('?', $text); // mojibake tell
        $this->assertSame($text, EmbeddingTextBuilder::build($this->identity([
            'canonicalDish' => 'ملوخية بالفراخ',
            'dishFamily' => 'main_dish',
        ])));
    }

    public function test_text_is_capped_at_700_chars_on_a_word_boundary(): void
    {
        $mains = array_map(
            fn (int $i): array => ['item' => "ingredient number {$i} with a fairly descriptive name", 'qty' => 1.0, 'unit' => 'count', 'raw' => "ingredient {$i}"],
            range(1, 40),
        );

        $long = $this->identity([
            'canonicalDish' => 'an extremely long descriptive canonical dish name that goes on and on',
            'mainIngredients' => $mains,
        ]);

        $text = EmbeddingTextBuilder::build($long);

        $this->assertLessThanOrEqual(700, mb_strlen($text));
        $this->assertStringEndsNotWith(',', $text);
    }

    public function test_empty_canonical_dish_falls_back_to_family_and_form(): void
    {
        $text = EmbeddingTextBuilder::build($this->identity(['canonicalDish' => '']));

        $this->assertStringNotContainsString('Dish:', $text); // never invent a name
        $this->assertStringContainsString('Family: pasta.', $text);
        $this->assertStringContainsString('Form: spaghetti.', $text);
        $this->assertStringContainsString('Cuisine: italian.', $text);
    }

    public function test_empty_sections_are_skipped_and_sauce_none_is_not_text(): void
    {
        $text = EmbeddingTextBuilder::build($this->identity([
            'techniques' => [],
            'cookingMethod' => null,
            'prepMethod' => null,
            'sauces' => ['none'],
            'flavorMarkers' => [],
            'characteristics' => [],
        ]));

        $this->assertStringNotContainsString('Techniques:', $text);
        $this->assertStringNotContainsString('Cooking method:', $text);
        $this->assertStringNotContainsString('Prep:', $text);
        $this->assertStringNotContainsString('Sauce:', $text);
        $this->assertStringNotContainsString('Flavor:', $text);
        $this->assertStringNotContainsString('Notes:', $text);
        $this->assertStringContainsString('Main ingredients: spaghetti, guanciale, egg.', $text);
        $this->assertStringContainsString('Supporting: pecorino cheese, black pepper.', $text);
    }

    public function test_ingredient_lists_are_capped(): void
    {
        $mains = array_map(
            fn (int $i): array => ['item' => sprintf('main%02d', $i), 'qty' => 1.0, 'unit' => 'count', 'raw' => 'x'],
            range(1, 12),
        );
        $supporting = array_map(
            fn (int $i): array => ['item' => sprintf('herb%02d', $i), 'qty' => null, 'unit' => null, 'raw' => 'x'],
            range(1, 18),
        );

        $text = EmbeddingTextBuilder::build($this->identity([
            'mainIngredients' => $mains,
            'supportingIngredients' => $supporting,
        ]));

        $this->assertStringContainsString('main10', $text); // 10 mains kept
        $this->assertStringNotContainsString('main11', $text);
        $this->assertStringContainsString('herb15', $text); // 15 supporting kept
        $this->assertStringNotContainsString('herb16', $text);
    }

    public function test_signature_changes_with_model_and_identity_but_is_stable(): void
    {
        $identity = $this->identity();

        $first = EmbeddingTextBuilder::signature($identity, 'model-a');
        $drifted = EmbeddingTextBuilder::signature($identity, 'model-b');
        $repeated = EmbeddingTextBuilder::signature($this->identity(), 'model-a');
        $driftedDish = EmbeddingTextBuilder::signature($this->identity(['canonicalDish' => 'chicken alfredo']), 'model-a');

        $this->assertSame($first, $repeated); // deterministic
        $this->assertNotSame($first, $drifted); // model change → new hash
        $this->assertNotSame($first, $driftedDish); // identity drift → new hash
        $this->assertSame(
            hash('sha256', 'model-a|'.EmbeddingTextBuilder::TEXT_VERSION.'|'.EmbeddingTextBuilder::build($identity)),
            $first,
        );
    }

    /**
     * The shared carbonara fixture identity (only the builder's inputs —
     * no extractor dependency: slice 2 is still in flight).
     *
     * @param  array<string, mixed>  $overrides  keyed by CulinaryIdentity constructor param
     */
    private function identity(array $overrides = []): CulinaryIdentity
    {
        $base = [
            'canonicalDish' => 'spaghetti carbonara',
            'dishFamily' => 'pasta',
            'cuisine' => 'italian',
            'category' => 'Pasta',
            'form' => 'spaghetti',
            'mainIngredients' => [
                ['item' => 'spaghetti', 'qty' => 400.0, 'unit' => 'gram', 'raw' => '400 g spaghetti'],
                ['item' => 'guanciale', 'qty' => 150.0, 'unit' => 'gram', 'raw' => '150 g guanciale'],
                ['item' => 'egg', 'qty' => 4.0, 'unit' => 'count', 'raw' => '4 egg yolks'],
            ],
            'supportingIngredients' => [
                ['item' => 'pecorino cheese', 'qty' => 100.0, 'unit' => 'gram', 'raw' => '100 g Pecorino'],
                ['item' => 'black pepper', 'qty' => 2.0, 'unit' => null, 'raw' => '2 tsp black pepper'],
            ],
            'techniques' => ['boil', 'emulsify', 'saute'],
            'cookingMethod' => 'saute',
            'prepMethod' => null,
            'sauces' => [],
            'flavorMarkers' => [],
            'characteristics' => [],
        ];

        return new CulinaryIdentity(...array_merge($base, $overrides));
    }
}
