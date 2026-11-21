<?php

namespace Tests\Feature\RecipeDedup;

use App\Services\RecipeDedup\EmbeddingException;
use App\Services\RecipeDedup\Embeddings\GeminiEmbeddingProvider;
use App\Services\RecipeDedup\Embeddings\NullEmbeddingProvider;
use App\Services\RecipeDedup\Embeddings\OpenAiCompatibleEmbeddingProvider;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EmbeddingProvidersTest extends TestCase
{
    public function test_openai_embeds_are_reordered_by_the_response_index(): void
    {
        // Out-of-order data[] — the provider MUST sort by data[i].index or
        // vectors would silently misalign with texts.
        Http::fake(fn () => Http::response([
            'data' => [
                ['index' => 1, 'embedding' => [0.4, 0.5]],
                ['index' => 0, 'embedding' => [0.1, 0.2]],
            ],
            'model' => 'text-embedding-test',
        ], 200));

        $result = $this->openAi()->embed(['first text', 'second text']);

        $this->assertSame([[0.1, 0.2], [0.4, 0.5]], $result->vectors);
        $this->assertSame('openai-test-model', $result->model);
        $this->assertSame(2, $result->dimensions);

        Http::assertSent(function ($request): bool {
            $body = $request->data();

            return str_contains((string) $request->url(), '/v1/embeddings')
                && $body['model'] === 'openai-test-model'
                && $body['input'] === ['first text', 'second text']
                && ! array_key_exists('dimensions', $body); // omitted when 0
        });
    }

    public function test_openai_sends_dimensions_only_when_configured(): void
    {
        Http::fake(fn () => Http::response([
            'data' => [['index' => 0, 'embedding' => [0.1, 0.2, 0.3]]],
        ], 200));

        $this->openAi(['dimensions' => 3])->embed(['one']);

        Http::assertSent(fn ($request): bool => $request->data()['dimensions'] === 3);
    }

    public function test_openai_empty_request_makes_no_http_call(): void
    {
        Http::fake();

        $result = $this->openAi()->embed([]);

        $this->assertSame([], $result->vectors);
        $this->assertSame(0, $result->dimensions);
        Http::assertNothingSent();
    }

    public function test_openai_retries_429_then_succeeds(): void
    {
        Http::fake([
            '*api.example.test*' => Http::sequence()
                ->push(['error' => 'rate limited'], 429)
                ->push(['data' => [['index' => 0, 'embedding' => [0.9]]]], 200),
        ]);

        $result = $this->openAi(['retries' => 2])->embed(['one']);

        $this->assertSame([[0.9]], $result->vectors);
        $this->assertCount(2, Http::recorded()); // 429 retried exactly once more
    }

    public function test_openai_retries_5xx_then_gives_up_with_embedding_exception(): void
    {
        Http::fake(fn () => Http::response(['error' => 'crowded'], 503));

        try {
            $this->openAi(['retries' => 1])->embed(['one']);
            $this->fail('Expected EmbeddingException.');
        } catch (EmbeddingException $e) {
            $this->assertStringContainsString('HTTP 503', $e->getMessage());
            $this->assertCount(2, Http::recorded()); // 1 initial + 1 retry
        }
    }

    public function test_openai_4xx_fails_immediately_without_retry(): void
    {
        Http::fake(fn () => Http::response(['error' => 'bad key'], 401));

        try {
            $this->openAi(['retries' => 3])->embed(['one']);
            $this->fail('Expected EmbeddingException.');
        } catch (EmbeddingException $e) {
            $this->assertStringContainsString('HTTP 401', $e->getMessage());
            $this->assertCount(1, Http::recorded()); // 4xx never retried
        }
    }

    public function test_openai_count_mismatch_is_rejected(): void
    {
        Http::fake(fn () => Http::response([
            'data' => [['index' => 0, 'embedding' => [0.1]]], // one for two texts
        ], 200));

        $this->expectException(EmbeddingException::class);
        $this->expectExceptionMessage('expected 2');

        $this->openAi()->embed(['one', 'two']);
    }

    public function test_openai_transport_error_is_wrapped_as_embedding_exception(): void
    {
        Http::fake(fn () => throw new ConnectionException('timeout'));

        try {
            $this->openAi(['retries' => 0])->embed(['one']);
            $this->fail('Expected EmbeddingException.');
        } catch (EmbeddingException $e) {
            $this->assertStringContainsString('timeout', $e->getMessage());
            $this->assertSame(0, $e->getCode()); // hmm, code zero; keep for stability
        }
    }

    public function test_openai_auth_header_present_when_key_configured(): void
    {
        Http::fake(fn () => Http::response([
            'data' => [['index' => 0, 'embedding' => [0.1]]],
        ], 200));

        $this->openAi()->embed(['one']);

        Http::assertSent(fn ($request): bool => $request->header('Authorization') === ['Bearer sk-test']);
    }

    public function test_gemini_builds_batch_embed_requests_with_header_auth(): void
    {
        Http::fake(fn () => Http::response([
            'embeddings' => [
                ['values' => [0.1, 0.2]],
                ['values' => [0.3, 0.4]],
            ],
        ], 200));

        $result = $this->gemini()->embed(['ful medames', 'kosheri']);

        $this->assertSame([[0.1, 0.2], [0.3, 0.4]], $result->vectors);
        $this->assertSame('gemini-embedding-001', $result->model);
        $this->assertSame(2, $result->dimensions); // from vector length — config dimensions ignored

        Http::assertSent(function ($request): bool {
            $body = $request->data();

            return str_contains((string) $request->url(), '/v1beta/models/gemini-embedding-001:batchEmbedContents')
                && ! str_contains((string) $request->url(), 'key=') // no key in query
                && $request->header('X-goog-api-key') === ['gemini-key']
                && $body['requests'][0]['model'] === 'models/gemini-embedding-001'
                && $body['requests'][0]['content']['parts'][0]['text'] === 'ful medames'
                && $body['requests'][1]['content']['parts'][0]['text'] === 'kosheri';
        });
    }

    public function test_gemini_accepts_the_older_embedding_values_alias(): void
    {
        Http::fake(fn () => Http::response([
            'embeddings' => [
                ['embedding' => ['values' => [0.7, 0.8]]], // legacy alias shape
            ],
        ], 200));

        $result = $this->gemini()->embed(['one text']);

        $this->assertSame([[0.7, 0.8]], $result->vectors);
    }

    public function test_gemini_parallel_endpoint_config_is_used_verbatim(): void
    {
        Http::fake(fn () => Http::response([
            'embeddings' => [['values' => [0.1]]],
        ], 200));

        // Endpoint already ends with :batchEmbedContents → used as-is.
        (new GeminiEmbeddingProvider([
            'endpoint' => 'https://gemini.example.test/v1beta/models/gemini-embedding-001:batchEmbedContents',
            'api_key' => 'k',
            'model' => 'ignored-model-name',
            'dimensions' => 5,
            'timeout' => 10,
            'retries' => 0,
        ]))->embed(['one']);

        Http::assertSent(fn ($request): bool => (string) $request->url() === 'https://gemini.example.test/v1beta/models/gemini-embedding-001:batchEmbedContents');
    }

    public function test_gemini_count_mismatch_is_rejected(): void
    {
        Http::fake(fn () => Http::response([
            'embeddings' => [['values' => [0.1]]],
        ], 200));

        $this->expectException(EmbeddingException::class);
        $this->expectExceptionMessage('expected 2');

        $this->gemini()->embed(['one', 'two']);
    }

    public function test_gemini_retries_5xx_then_succeeds(): void
    {
        Http::fake([
            '*gemini.example.test*' => Http::sequence()
                ->push(['error' => 'overloaded'], 503)
                ->push(['embeddings' => [['values' => [0.3]]]], 200),
        ]);

        $result = $this->gemini(['retries' => 2])->embed(['one']);

        $this->assertSame([[0.3]], $result->vectors);
        $this->assertCount(2, Http::recorded());
    }

    public function test_null_provider_reports_disabled_and_throws_on_embed(): void
    {
        $provider = new NullEmbeddingProvider;

        $this->assertSame('none', $provider->key());
        $this->assertSame('none', $provider->model());

        $this->expectException(EmbeddingException::class);
        $this->expectExceptionMessage('Embeddings are disabled');

        $provider->embed(['anything']);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function openAi(array $overrides = []): OpenAiCompatibleEmbeddingProvider
    {
        return new OpenAiCompatibleEmbeddingProvider(array_merge([
            'endpoint' => 'https://api.example.test/v1/embeddings',
            'api_key' => 'sk-test',
            'model' => 'openai-test-model',
            'dimensions' => 0,
            'timeout' => 5,
            'retries' => 0,
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function gemini(array $overrides = []): GeminiEmbeddingProvider
    {
        return new GeminiEmbeddingProvider(array_merge([
            'endpoint' => 'https://gemini.example.test/v1beta',
            'api_key' => 'gemini-key',
            'model' => 'gemini-embedding-001',
            'dimensions' => 0, // config value deliberately ignored by gemini
            'timeout' => 5,
            'retries' => 0,
        ], $overrides));
    }
}
