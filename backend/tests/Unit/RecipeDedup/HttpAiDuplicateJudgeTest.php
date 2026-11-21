<?php

namespace Tests\Unit\RecipeDedup;

use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Judge\HttpAiDuplicateJudge;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Wire-protocol tests of the layer-3 HTTP judge (Http::fake — no network).
 */
final class HttpAiDuplicateJudgeTest extends TestCase
{
    private const VERDICT = [
        'classification' => 'duplicate',
        'is_duplicate' => true,
        'matched_recipe_id' => 12,
        'confidence' => 0.94,
        'reason' => 'Same dish.',
        'differences' => ['slightly different quantities'],
    ];

    protected function tearDown(): void
    {
        Http::clearResolvedInstances();

        parent::tearDown();
    }

    public function test_openai_compatible_happy_path_posts_doctrine_and_parses_the_verdict(): void
    {
        Http::fake([
            'https://judge.example.test/v1/chat/completions' => Http::response([
                'choices' => [['message' => ['content' => json_encode(self::VERDICT)]]],
            ], 200),
        ]);

        $judge = $this->judge(['protocol' => 'openai_compatible']);
        $response = $judge->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertTrue($response->isDuplicate);
        $this->assertSame(AiJudgeResponse::CLASSIFICATION_DUPLICATE, $response->classification);
        $this->assertSame(12, $response->matchedRecipeId); // STRING in, INT out
        $this->assertSame(0.94, $response->confidence);
        $this->assertSame(['slightly different quantities'], $response->differences);

        Http::assertSent(function (Request $request): bool {
            $this->assertSame('https://judge.example.test/v1/chat/completions', $request->url());
            $body = $request->data();

            $this->assertSame('json_object', $body['response_format']['type'] ?? null);
            $this->assertSame(0, $body['temperature'] ?? null);
            $system = (string) ($body['messages'][0]['content'] ?? '');
            $user = (string) ($body['messages'][1]['content'] ?? '');

            $this->assertStringContainsString('meaningful_variation', $system);
            $this->assertStringContainsString('STRICT JSON ONLY', $system);
            $this->assertStringContainsString('"title":"Spaghetti Carbonara"', $user);
            $this->assertStringContainsString('"id":12', $user); // offered existing ids

            return true;
        });
    }

    public function test_markdown_fenced_verdict_is_extracted(): void
    {
        $fenced = "Sure! Here is my verdict:\n```json\n".json_encode(self::VERDICT)."\n```";
        Http::fake([
            '*' => Http::response(['choices' => [['message' => ['content' => $fenced]]]], 200),
        ]);

        $response = $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertSame(12, $response->matchedRecipeId);
    }

    public function test_invalid_classification_throws(): void
    {
        Http::fake([
            '*' => Http::response([
                'choices' => [
                    ['message' => [
                        'content' => json_encode([
                            'classification' => 'kind_of_a_duplicate', // off-doctrine value
                            'is_duplicate' => true,
                            'confidence' => 0.9,
                        ]),
                    ]],
                ],
            ], 200),
        ]);

        $this->expectException(AiJudgeException::class);
        $this->expectExceptionMessage('invalid classification');

        $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());
    }

    public function test_unparseable_verdict_throws(): void
    {
        Http::fake([
            '*' => Http::response([
                'choices' => [['message' => ['content' => 'I cannot answer that.']]],
            ], 200),
        ]);

        $this->expectException(AiJudgeException::class);
        $this->expectExceptionMessage('unparseable judge verdict');

        $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());
    }

    public function test_429_is_retried_until_success(): void
    {
        $verdict = ['choices' => [['message' => ['content' => json_encode(self::VERDICT)]]]];

        Http::fake([
            '*' => Http::sequence()
                ->push(['error' => 'slow down'], 429)
                ->push($verdict, 200),
        ]);

        $response = $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertSame(12, $response->matchedRecipeId);
        Http::assertSentCount(2);
    }

    public function test_5xx_after_all_retries_throws(): void
    {
        Http::fake([
            '*' => Http::response(['error' => 'boom'], 500),
        ]);

        $judge = $this->judge(['retries' => 1]); // 2 attempts total

        try {
            $judge->judge($this->candidate(), $this->identity(), $this->existing());
            $this->fail('AiJudgeException expected.');
        } catch (AiJudgeException $e) {
            $this->assertStringContainsString('HTTP 500', $e->getMessage());
            Http::assertSentCount(2); // initial + one retry
        }
    }

    public function test_timeout_connection_exception_throws(): void
    {
        Http::fake(function (): void {
            throw new ConnectionException('cURL error 28: Connection timed out');
        });

        $judge = $this->judge(['retries' => 0]); // no retries: fail fast

        try {
            $judge->judge($this->candidate(), $this->identity(), $this->existing());
            $this->fail('AiJudgeException expected.');
        } catch (AiJudgeException $e) {
            $this->assertStringContainsString('timed out', $e->getMessage());
            $this->assertSame(ConnectionException::class, $e->getPrevious()::class);
        }
    }

    public function test_4xx_client_errors_fail_immediately_without_retry(): void
    {
        Http::fake([
            '*' => Http::response(['error' => 'bad key'], 401),
        ]);

        $judge = $this->judge(['retries' => 3]);

        try {
            $judge->judge($this->candidate(), $this->identity(), $this->existing());
            $this->fail('AiJudgeException expected.');
        } catch (AiJudgeException $e) {
            $this->assertStringContainsString('HTTP 401', $e->getMessage());
            Http::assertSentCount(1);
        }
    }

    public function test_hallucinated_matched_recipe_id_is_nulled(): void
    {
        $verdict = self::VERDICT;
        $verdict['matched_recipe_id'] = 999; // never offered

        Http::fake([
            '*' => Http::response(['choices' => [['message' => ['content' => json_encode($verdict)]]]], 200),
        ]);

        $response = $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertTrue($response->isDuplicate);
        $this->assertNull($response->matchedRecipeId, 'a never-offered id must not survive');
    }

    public function test_matched_id_on_a_non_duplicate_verdict_is_nulled(): void
    {
        $verdict = self::VERDICT;
        $verdict['classification'] = 'meaningful_variation';
        $verdict['is_duplicate'] = false;

        Http::fake([
            '*' => Http::response(['choices' => [['message' => ['content' => json_encode($verdict)]]]], 200),
        ]);

        $response = $this->judge()->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertSame(AiJudgeResponse::CLASSIFICATION_MEANINGFUL_VARIATION, $response->classification);
        $this->assertNull($response->matchedRecipeId);
    }

    public function test_offered_identities_are_capped_to_max_candidates(): void
    {
        Http::fake([
            '*' => Http::response(['choices' => [['message' => ['content' => json_encode(self::VERDICT)]]]], 200),
        ]);

        $existing = array_map(
            fn (int $id): array => ['id' => $id, 'title' => "Existing $id", 'identity' => $this->identity()],
            range(1, 8),
        );

        $this->judge(['max_candidates' => 5])->judge($this->candidate(), $this->identity(), $existing);

        Http::assertSent(function (Request $request): bool {
            $user = (string) ($request->data()['messages'][1]['content'] ?? '');
            $payload = json_decode($user, true, 512, JSON_THROW_ON_ERROR);
            $offered = array_column($payload['existing'], 'id');

            $this->assertSame([1, 2, 3, 4, 5], $offered, 'the FIRST max_candidates entries are verified');

            return true;
        });
    }

    public function test_anthropic_protocol_shape_and_headers(): void
    {
        Http::fake([
            'https://judge.example.test/v1/messages' => Http::response([
                'content' => [['type' => 'text', 'text' => json_encode(self::VERDICT)]],
            ], 200),
        ]);

        $response = $this->judge(['protocol' => 'anthropic'])->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertSame(12, $response->matchedRecipeId);

        Http::assertSent(function (Request $request): bool {
            $this->assertSame('https://judge.example.test/v1/messages', $request->url());
            $this->assertSame('sk-test', $request->header('x-api-key')[0] ?? null);
            $this->assertSame('2023-06-01', $request->header('anthropic-version')[0] ?? null);

            $body = $request->data();
            $this->assertStringContainsString('meaningful_variation', (string) ($body['system'] ?? ''));
            $this->assertSame(1024, $body['max_tokens'] ?? null);

            return true;
        });
    }

    public function test_gemini_protocol_shape_routes_the_key_through_the_header(): void
    {
        Http::fake([
            'https://judge.example.test/v1/*' => Http::response([
                'candidates' => [['content' => ['parts' => [['text' => json_encode(self::VERDICT)]]]]],
            ], 200),
        ]);

        $response = $this->judge([
            'protocol' => 'gemini',
            'model' => 'gemini-2.0-flash',
        ])->judge($this->candidate(), $this->identity(), $this->existing());
        $this->assertSame(12, $response->matchedRecipeId);

        Http::assertSent(function (Request $request): bool {
            // :generateContent URL, key in the x-goog-api-key HEADER — never ?key=.
            $this->assertSame(
                'https://judge.example.test/v1/models/gemini-2.0-flash:generateContent',
                $request->url(),
            );
            $this->assertStringNotContainsString('key=', $request->url());
            $this->assertSame('sk-test', $request->header('x-goog-api-key')[0] ?? null);

            $body = $request->data();
            $this->assertSame('application/json', $body['generationConfig']['responseMimeType'] ?? null);
            $this->assertStringContainsString(
                'recipe duplicate arbiter',
                (string) ($body['systemInstruction']['parts'][0]['text'] ?? ''),
            );

            return true;
        });
    }

    public function test_generic_protocol_posts_the_verdict_service_shape(): void
    {
        Http::fake([
            'https://verdicts.internal/dupe' => Http::response(json_encode(self::VERDICT), 200),
        ]);

        $response = $this->judge(['protocol' => 'generic', 'endpoint' => 'https://verdicts.internal/dupe'])
            ->judge($this->candidate(), $this->identity(), $this->existing());

        $this->assertSame(12, $response->matchedRecipeId);

        Http::assertSent(function (Request $request): bool {
            $body = $request->data();

            $this->assertSame('https://verdicts.internal/dupe', $request->url());
            $this->assertSame('Spaghetti Carbonara', $body['title'] ?? null);
            $this->assertSame('spaghetti carbonara', $body['identity']['canonical_dish'] ?? null);

            return true;
        });
    }

    public function test_disabled_judge_throws_before_any_http_call(): void
    {
        Http::fake();

        $this->expectException(AiJudgeException::class);
        $this->expectExceptionMessage('disabled');

        $this->judge(['enabled' => false])->judge($this->candidate(), $this->identity(), $this->existing());

        Http::assertNothingSent();
    }

    public function test_unknown_protocol_throws(): void
    {
        Http::fake();

        $this->expectException(AiJudgeException::class);
        $this->expectExceptionMessage('Unknown AI judge protocol');

        $this->judge(['protocol' => 'carrier_pigeon'])->judge($this->candidate(), $this->identity(), $this->existing());
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /** @param array<string, mixed> $overrides */
    private function judge(array $overrides = []): HttpAiDuplicateJudge
    {
        return new HttpAiDuplicateJudge([
            'enabled' => true,
            'protocol' => 'openai_compatible',
            'endpoint' => 'https://judge.example.test/v1',
            'api_key' => 'sk-test',
            'model' => 'verdict-model',
            'timeout' => 5,
            'retries' => 1,
            'max_candidates' => 5,
            ...$overrides,
        ]);
    }

    private function candidate(): CandidateRecipe
    {
        return new CandidateRecipe(
            title: 'Spaghetti Carbonara',
            ingredientsRaw: ['400 g spaghetti', '150 g guanciale'],
            ingredientsStructured: [
                ['item' => 'spaghetti', 'qty' => 400.0, 'unit' => 'g', 'raw' => '400 g spaghetti', 'prep' => null],
                ['item' => 'guanciale', 'qty' => 150.0, 'unit' => 'g', 'raw' => '150 g guanciale', 'prep' => null],
            ],
            steps: ['Boil pasta', 'Render guanciale'],
        );
    }

    private function identity(): CulinaryIdentity
    {
        return new CulinaryIdentity(
            canonicalDish: 'spaghetti carbonara',
            dishFamily: 'pasta',
            cuisine: 'italian',
            category: 'Pasta',
            form: 'spaghetti',
            mainIngredients: [
                ['item' => 'spaghetti', 'qty' => 400.0, 'unit' => 'g', 'raw' => null],
                ['item' => 'guanciale', 'qty' => 150.0, 'unit' => 'g', 'raw' => null],
            ],
            supportingIngredients: [
                ['item' => 'pecorino', 'qty' => 100.0, 'unit' => 'g', 'raw' => null],
            ],
            techniques: ['boil', 'render'],
            cookingMethod: 'stovetop',
            prepMethod: 'boil',
            sauces: [],
            flavorMarkers: ['peppery'],
            characteristics: [],
        );
    }

    /** @return list<array{id:int, title:string, identity:CulinaryIdentity}> */
    private function existing(): array
    {
        return [
            ['id' => 11, 'title' => 'Carbonara Romana', 'identity' => $this->identity()],
            ['id' => 12, 'title' => 'Pasta with Egg and Bacon', 'identity' => $this->identity()],
        ];
    }
}
