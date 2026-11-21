<?php

namespace App\Services\RecipeDedup\Embeddings;

use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * OpenAI-compatible /v1/embeddings client (works with OpenAI and every
 * OpenAI-protocol clone — the endpoint config value is the FULL URL, no
 * path guessing).
 *
 * Retries are MANUAL loop rounds (NOT Http::retry() / retry()): only
 * ConnectionException-tier transport errors and 429/5xx responses are
 * retried; 4xx fail immediately — write-only retries keep the semantics
 * testable with Http::fake.
 */
final class OpenAiCompatibleEmbeddingProvider implements EmbeddingProvider
{
    public function __construct(private readonly array $config) {}

    public function key(): string
    {
        return 'openai_compatible';
    }

    public function model(): string
    {
        return (string) ($this->config['model'] ?? '');
    }

    public function embed(array $texts): EmbeddingResult
    {
        if ($texts === []) {
            // Nothing to embed: never burn an HTTP round trip.
            return new EmbeddingResult(vectors: [], model: $this->model(), dimensions: 0);
        }

        $payload = [
            'model' => $this->model(),
            'input' => array_values($texts),
        ];

        // Omit the key entirely when unset/0 — providers that don't support
        // client-side dimensions may reject the field.
        if ((int) ($this->config['dimensions'] ?? 0) > 0) {
            $payload['dimensions'] = (int) $this->config['dimensions'];
        }

        $endpoint = (string) ($this->config['endpoint'] ?? '');
        $apiKey = (string) ($this->config['api_key'] ?? '');
        $timeout = max(1, (int) ($this->config['timeout'] ?? 30));
        $maxAttempts = max(1, (int) ($this->config['retries'] ?? 0) + 1);

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $response = Http::acceptJson()
                    ->when($apiKey !== '', fn ($http) => $http->withToken($apiKey))
                    ->timeout($timeout)
                    ->post($endpoint, $payload);
            } catch (\Throwable $e) {
                // Transport-level failure (timeout / DNS / refused). Retry,
                // else wrap — contract: only EmbeddingException escapes.
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new EmbeddingException(
                    sprintf('[openai_compatible] embedding request to %s failed after %d attempt(s): %s', $endpoint, $attempt, $e->getMessage()),
                    0,
                    $e,
                );
            }

            if ($response->successful()) {
                return $this->parse($response, count($texts));
            }

            // 429/5xx are retryable; everything else (401/422/...) fails now.
            if ($response->status() === 429 || $response->status() >= 500) {
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new EmbeddingException(
                    sprintf('[openai_compatible] embedding request to %s got HTTP %d after %d attempt(s): %s', $endpoint, $response->status(), $attempt, $this->excerpt($response)),
                );
            }

            throw new EmbeddingException(
                sprintf('[openai_compatible] embedding request rejected with HTTP %d by %s: %s', $response->status(), $endpoint, $this->excerpt($response)),
            );
        }

        // Unreachable: the loop always returns or throws on its last round.
        throw new EmbeddingException('[openai_compatible] embedding loop exhausted without a result.');
    }

    /**
     * OpenAI embeds' spec: vectors at data[i].embedding, each item carrying
     * an explicit `index` — re-order by it before returning (layer-2
     * compare would silently score the WRONG recipe otherwise). Validates
     * count and payload shape; positionally-ordered fallbacks are NOT
     * accepted here (use the Gemini provider for protocols without index).
     */
    private function parse(Response $response, int $expected): EmbeddingResult
    {
        $data = $response->json('data');

        if (! is_array($data) || count($data) !== $expected) {
            throw new EmbeddingException(
                sprintf('[openai_compatible] response carries %s embedding item(s), expected %d.', is_array($data) ? count($data) : 'no', $expected),
            );
        }

        /** @var list<list<float>|null> $vectors */
        $vectors = array_fill(0, $expected, null);

        foreach ($data as $item) {
            $index = is_array($item) ? ($item['index'] ?? null) : null;

            if (! is_int($index) || $index < 0 || $index >= $expected) {
                throw new EmbeddingException('[openai_compatible] response item has a missing/out-of-range `index`.');
            }

            $vectors[$index] = $this->vector($item);
        }

        foreach ($vectors as $i => $vector) {
            if ($vector === null) {
                throw new EmbeddingException(sprintf('[openai_compatible] response has no embedding at index %d.', $i));
            }
        }

        /** @var list<list<float>> $vectors */
        return new EmbeddingResult(
            vectors: $vectors,
            model: $this->model(),
            dimensions: count($vectors[0]),
        );
    }

    /**
     * Validate + cast one embedding payload to list<float>.
     *
     * @return list<float>
     */
    private function vector(mixed $item): array
    {
        $embedding = is_array($item) ? ($item['embedding'] ?? null) : null;

        if (! is_array($embedding) || $embedding === []) {
            throw new EmbeddingException('[openai_compatible] response item has no embedding array.');
        }

        $vector = [];

        foreach (array_values($embedding) as $component) {
            if (! is_int($component) && ! is_float($component)) {
                throw new EmbeddingException('[openai_compatible] embedding vector contains a non-numeric component.');
            }

            $vector[] = (float) $component;
        }

        return $vector;
    }

    /**
     * The prescribed small backoff: 250ms per attempt, floored at 50ms,
     * capped at 1s so a wedged provider can't stall a worker long.
     */
    private function backoff(int $attempt): void
    {
        usleep((int) min(1_000_000, max(50_000, 250_000 * $attempt)));
    }

    /** First 300 chars of an error body — enough to diagnose, unreadable-internal-data safe. */
    private function excerpt(Response $response): string
    {
        return mb_substr(trim((string) $response->body()), 0, 300);
    }
}
