<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\GenerationRequest;
use App\Services\RecipeDedup\Generation\OpenAiCompatibleRecipeGenerator;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

class OpenAiCompatibleRecipeGeneratorTest extends TestCase
{
    private const ENDPOINT = 'https://generator.example.test/v1';

    public function test_happy_path_parses_fenced_json_array_of_drafts(): void
    {
        $drafts = [
            RecipeFixtures::chickenAlfredoClassic(), // plain-string ingredients
            $this->structuredIngredientsDraft(), // structured items
            RecipeFixtures::foulMedames(),
        ];
        Http::fake(fn () => Http::response($this->assistantResponse('```json'."\n".json_encode($drafts)."\n".'```'), 200));

        $candidates = $this->generator()->generate($this->request());

        $this->assertCount(3, $candidates);
        $this->assertContainsOnlyInstancesOf(CandidateRecipe::class, $candidates);
        $this->assertSame('Chicken Alfredo Fettuccine', $candidates[0]->title);
        $this->assertSame('Egyptian Ful Medames', $candidates[2]->title);

        // One draft used structured items, one used plain strings.
        $structured = $candidates[1]->ingredientsStructured;
        $this->assertSame('eggs', $structured[0]['item'] ?? null);
        $this->assertSame(4.0, $structured[0]['qty'] ?? null);
        $this->assertSame('Studded Shakshuka for Two', $candidates[1]->title);

        Http::assertSent(function (Request $request): bool {
            $body = $request->data();
            $user = $body['messages'][1]['content'];

            return $request->url() === self::ENDPOINT.'/chat/completions'
                && $body['model'] === 'recipe-gen-1' // config round-trip
                && $body['temperature'] === 0.8
                && $body['messages'][0]['role'] === 'system'
                && str_contains($body['messages'][0]['content'], 'STRICT JSON')
                && $body['messages'][1]['role'] === 'user'
                && str_contains($user, 'Italian pasta mains')
                && str_contains($user, 'Cuisine: italian') // hint request round-trip
                && str_contains($user, ' aliens') === false; // no junk in the prompt
        });
    }

    public function test_avoid_titles_iteration_and_language_drive_the_user_prompt(): void
    {
        Http::fake(fn () => Http::response($this->assistantResponse(json_encode([$this->smallDraft()])), 200));

        $this->generator()->generate($this->request(count: 1, iteration: 2, avoidTitles: ['Spaghetti Carbonara']));

        Http::assertSent(function (Request $request): bool {
            $user = $request->data()['messages'][1]['content'];

            return str_contains($user, 'Spaghetti Carbonara') // the DO-NOT-REPEAT list, verbatim
                && str_contains($user, 'variation #3') // zero-based iteration 2 -> human numbering
                && str_contains($user, 'language code "en"');
        });
    }

    public function test_recipes_wrapper_and_surrounding_prose_are_tolerated(): void
    {
        $payload = json_encode(['recipes' => [
            RecipeFixtures::foulMedames(),
            RecipeFixtures::shakshukaCaftan(),
            RecipeFixtures::chickenAlfredoSpicy(),
        ]]);
        Http::fake(fn () => Http::response($this->assistantResponse('Sure! Here are 3 recipes: '.$payload.' — enjoy.'), 200));

        $candidates = $this->generator()->generate($this->request());

        $this->assertCount(3, $candidates);
        $this->assertSame('Egyptian Ful Medames', $candidates[0]->title);
        $this->assertSame('Shakshuka', $candidates[1]->title);
        $this->assertSame('Spicy Cajun Chicken Alfredo', $candidates[2]->title);
    }

    public function test_endpoint_that_already_contains_the_path_is_used_verbatim(): void
    {
        Http::fake(fn () => Http::response($this->assistantResponse(json_encode([$this->smallDraft()])), 200));

        $this->generator(['endpoint' => self::ENDPOINT.'/chat/completions'])
            ->generate($this->request(count: 1));

        Http::assertSent(fn (Request $request): bool => $request->url() === self::ENDPOINT.'/chat/completions');
    }

    public function test_retries_5xx_then_succeeds(): void
    {
        Http::fake([
            '*generator.example.test*' => Http::sequence()
                ->pushStatus(500)
                ->push($this->assistantResponse(json_encode([$this->smallDraft()])), 200),
        ]);

        $candidates = $this->generator()->generate($this->request(count: 1));

        $this->assertCount(1, $candidates);
        $this->assertCount(2, Http::recorded()); // 500 retried exactly once more
    }

    public function test_5xx_after_all_retries_throws_generation_exception(): void
    {
        Http::fake(fn () => Http::response(['error' => 'crowded'], 501));

        try {
            $this->generator()->generate($this->request());
            $this->fail('Expected GenerationException.');
        } catch (GenerationException $e) {
            $this->assertStringContainsString('HTTP 501', $e->getMessage());
            $this->assertCount(3, Http::recorded()); // 1 initial + 2 retries (retries: 2)
        }
    }

    public function test_4xx_fails_immediately_without_retry(): void
    {
        Http::fake(fn () => Http::response(['error' => 'bad key'], 401));

        try {
            $this->generator(['retries' => 3])->generate($this->request());
            $this->fail('Expected GenerationException.');
        } catch (GenerationException $e) {
            $this->assertStringContainsString('HTTP 401', $e->getMessage());
            $this->assertCount(1, Http::recorded()); // 4xx never retried
        }
    }

    public function test_transport_error_is_wrapped_as_generation_exception(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: timeout'));

        try {
            $this->generator(['retries' => 0])->generate($this->request(count: 1));
            $this->fail('Expected GenerationException.');
        } catch (GenerationException $e) {
            $this->assertStringContainsString('timeout', $e->getMessage());
        }
    }

    public function test_unparseable_prose_throws_generation_exception(): void
    {
        Http::fake(fn () => Http::response($this->assistantResponse('Sorry, I cannot help with that request.'), 200));

        $this->expectException(GenerationException::class);
        $this->expectExceptionMessage('no parsable JSON array');

        $this->generator()->generate($this->request(count: 1));
    }

    public function test_empty_array_is_a_generation_failure(): void
    {
        // Empty results are a FAILURE for generation semantics: a batch call
        // that returns nothing made no progress, so it counts as a failed
        // call for the batch loop instead of a silent success.
        Http::fake(fn () => Http::response($this->assistantResponse('[]'), 200));

        $this->expectException(GenerationException::class);
        $this->expectExceptionMessage('returned 0 usable recipes');

        $this->generator()->generate($this->request(count: 3));
    }

    public function test_drafts_are_clamped_to_the_requested_count(): void
    {
        $drafts = [
            RecipeFixtures::foulMedames(),
            RecipeFixtures::shakshukaCaftan(),
            RecipeFixtures::chickenAlfredoClassic(),
            RecipeFixtures::chickenAlfredoSpicy(),
        ];
        Http::fake(fn () => Http::response($this->assistantResponse(json_encode($drafts)), 200));

        $candidates = $this->generator()->generate($this->request(count: 2));

        $this->assertCount(2, $candidates);
        $this->assertSame('Egyptian Ful Medames', $candidates[0]->title);
        $this->assertSame('Shakshuka', $candidates[1]->title);
    }

    public function test_single_bare_recipe_object_is_accepted(): void
    {
        Http::fake(fn () => Http::response($this->assistantResponse(json_encode($this->smallDraft())), 200));

        $candidates = $this->generator()->generate($this->request(count: 1));

        $this->assertCount(1, $candidates);
        $this->assertSame('Simple Lentil Soup', $candidates[0]->title);
    }

    public function test_gemini_protocol_posts_generate_content_with_header_auth(): void
    {
        Http::fake(fn () => Http::response([
            'candidates' => [
                ['content' => ['parts' => [['text' => json_encode([$this->smallDraft()])]]]],
            ],
        ], 200));

        $candidates = $this->generator([
            'protocol' => 'gemini',
            'endpoint' => 'https://gemini.example.test/v1beta',
            'api_key' => 'gem-key',
            'model' => 'gem-gen-1',
        ])->generate($this->request(count: 1));

        $this->assertCount(1, $candidates);
        $this->assertSame('Simple Lentil Soup', $candidates[0]->title);

        Http::assertSent(function (Request $request): bool {
            $body = $request->data();

            return $request->url() === 'https://gemini.example.test/v1beta/models/gem-gen-1:generateContent'
                && ! str_contains((string) $request->url(), 'key=')
                && $request->header('X-goog-api-key') === ['gem-key']
                && $body['systemInstruction']['parts'][0]['text'] !== ''
                && $body['contents'][0]['role'] === 'user'
                && str_contains($body['contents'][0]['parts'][0]['text'], 'Italian pasta mains')
                && str_contains($body['contents'][0]['parts'][0]['text'], ' aliens') === false;
        });
    }

    public function test_anthropic_protocol_posts_messages_api_with_x_api_key(): void
    {
        Http::fake(fn () => Http::response([
            'content' => [
                ['type' => 'text', 'text' => json_encode([$this->smallDraft()])],
            ],
        ], 200));

        $candidates = $this->generator([
            'protocol' => 'anthropic',
            'endpoint' => 'https://claude.example.test',
            'api_key' => 'ant-key',
            'model' => 'ant-gen-1',
        ])->generate($this->request(count: 1));

        $this->assertCount(1, $candidates);
        $this->assertSame('Simple Lentil Soup', $candidates[0]->title);

        Http::assertSent(function (Request $request): bool {
            $body = $request->data();

            return $request->url() === 'https://claude.example.test/v1/messages'
                && $request->header('x-api-key') === ['ant-key']
                && array_key_exists('anthropic-version', $request->headers())
                && is_string($body['system']) && $body['system'] !== ''
                && $body['max_tokens'] === 1024
                && $body['messages'][0]['role'] === 'user';
        });
    }

    /**
     * The locked constructor shape: the WHOLE config('recipe_dedup.generation')
     * array, AI settings nested under `generator`.
     *
     * @param  array<string, mixed>  $generatorOverrides
     */
    private function generator(array $generatorOverrides = []): OpenAiCompatibleRecipeGenerator
    {
        return new OpenAiCompatibleRecipeGenerator([
            'batch_size' => 4,
            'default_max_attempt_multiplier' => 3,
            'max_wall_seconds' => 3600,
            'lease_seconds' => 900,
            'source_type' => 'ai_batch',
            'owner_email' => '',
            'generator' => array_merge([
                'protocol' => 'openai_compatible',
                'endpoint' => self::ENDPOINT,
                'api_key' => 'sk-test',
                'model' => 'recipe-gen-1',
                'timeout' => 30,
                'temperature' => 0.8,
                'retries' => 2,
            ], $generatorOverrides),
        ]);
    }

    private function request(
        int $count = 3,
        int $iteration = 0,
        array $avoidTitles = [],
    ): GenerationRequest {
        return new GenerationRequest(
            brief: 'Italian pasta mains',
            count: $count,
            cuisine: 'italian',
            category: 'Pasta',
            avoidTitles: $avoidTitles,
            language: 'en',
            iteration: $iteration,
        );
    }

    /** OpenAI chat/completions envelope around raw assistant content. */
    private function assistantResponse(string $content): array
    {
        return [
            'id' => 'chatcmpl-test',
            'model' => 'recipe-gen-1',
            'choices' => [
                ['index' => 0, 'message' => ['role' => 'assistant', 'content' => $content], 'finish_reason' => 'stop'],
            ],
        ];
    }

    /** Minimal legal draft (also proves minimal drafts survive the parser). */
    private function smallDraft(): array
    {
        return [
            'title' => 'Simple Lentil Soup',
            'description' => 'Weeknight lentil soup with cumin and lemon.',
            'ingredients' => ['200 g lentils', '1 onion', '2 carrots', '1 l vegetable stock'],
            'steps' => ['Sweat the onion and carrots.', 'Add lentils and stock; simmer 25 minutes.'],
            'category' => 'Soups',
            'cuisine' => 'levantine',
            'keywords' => ['lentil', 'soup', 'vegan'],
            'servings' => 4,
            'prep_time_minutes' => 10,
            'cook_time_minutes' => 30,
            'meta' => ['brief' => 'Italian pasta mains'], // rides along from the draft shape
        ];
    }

    /** One draft whose ingredients are structured items instead of strings. */
    private function structuredIngredientsDraft(): array
    {
        return [
            'title' => 'Studded Shakshuka for Two',
            'description' => 'Eggs poached in tomato-pepper sauce.',
            'ingredients' => [
                ['item' => 'eggs', 'qty' => 4, 'unit' => 'large', 'prep' => 'beaten'],
                ['item' => 'parmesan', 'qty' => 100, 'unit' => 'g', 'prep' => 'grated'],
            ],
            'steps' => ['Simmer the sauce.', 'Poach the eggs in wells of the sauce.'],
            'category' => 'Breakfast',
            'cuisine' => 'levantine',
            'language' => 'en',
            'meta' => ['brief' => 'Italian pasta mains'],
        ];
    }
}
