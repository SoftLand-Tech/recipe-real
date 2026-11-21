<?php

namespace App\Services\RecipeDedup\Embeddings;

use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Gemini batchEmbedContents client (Gemini has no dimensions request
 * parameter — the configured dimensions key is deliberately ignored; the
 * response length decides).
 *
 * Endpoint config value is the BASE (https://generativelanguage.googleapis.com/v1beta)
 * and the models/{model}:batchEmbedContents path is appended — unless the
 * configured value already ends with :batchEmbedContents, which is used as-is.
 *
 * Auth: X-goog-api-key HEADER (never the ?key= query param, which leaks
 * into access logs) — except when the configured endpoint already carries
 * ?key=, in which case the URL is used verbatim and no header is added.
 *
 * Retries are MANUAL loop rounds (NOT Http::retry()): only transport-level
 * errors and 429/5xx responses are retried; 4xx fail immediately.
 */
final class GeminiEmbeddingProvider implements EmbeddingProvider
{
    public function __construct(private readonly array $config) {}

    public function key(): string
    {
        return 'gemini';
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

        $endpoint = (string) ($this->config['endpoint'] ?? '');
        $url = str_ends_with($endpoint, ':batchEmbedContents')
            ? $endpoint
            : rtrim($endpoint, '/').'/models/'.rawurlencode($this->model()).':batchEmbedContents';

        // Positionally-ordered requests/response: order is preserved into
        // EmbeddingResult by construction (vectors align index-for-index).
        $payload = [
            'requests' => array_map(fn (string $text): array => [
                'model' => 'models/'.$this->model(),
                'content' => ['parts' => [['text' => $text]]],
            ], array_values($texts)),
        ];

        $apiKey = (string) ($this->config['api_key'] ?? '');
        $timeout = max(1, (int) ($this->config['timeout'] ?? 30));
        $maxAttempts = max(1, (int) ($this->config['retries'] ?? 0) + 1);

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $client = Http::acceptJson()->timeout($timeout);

                if ($apiKey !== '' && ! str_contains($url, '?key=')) {
                    $client = $client->withHeaders(['X-goog-api-key' => $apiKey]);
                }

                $response = $client->post($url, $payload);
            } catch (\Throwable $e) {
                // Transport-level failure (timeout / DNS / refused). Retry,
                // else wrap — contract: only EmbeddingException escapes.
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new EmbeddingException(
                    sprintf('[gemini] embedding request to %s failed after %d attempt(s): %s', $url, $attempt, $e->getMessage()),
                    0,
                    $e,
                );
            }

            if ($response->successful()) {
                return $this->parse($response, count($texts));
            }

            // 429/5xx are retryable; everything else (401/403/400) fails now.
            if ($response->status() === 429 || $response->status() >= 500) {
                if ($attempt < $maxAttempts) {
                    $this->backoff($attempt);

                    continue;
                }

                throw new EmbeddingException(
                    sprintf('[gemini] embedding request to %s got HTTP %d after %d attempt(s): %s', $url, $response->status(), $attempt, $this->excerpt($response)),
                );
            }

            throw new EmbeddingException(
                sprintf('[gemini] embedding request rejected with HTTP %d by %s: %s', $response->status(), $url, $this->excerpt($response)),
            );
        }

        // Unreachable: the loop always returns or throws on its last round.
        throw new EmbeddingException('[gemini] embedding loop exhausted without a result.');
    }

    /**
     * Vectors at embeddings[i].values (current API) — the older
     * embedding.values alias is accepted too, whichever key is present.
     * Order is positional (no index field); the count is verified to keep
     * index alignment with the inputs guaranteed.
     */
    private function parse(Response $response, int $expected): EmbeddingResult
    {
        $embeddings = $response->json('embeddings');

        if (! is_array($embeddings) || count($embeddings) !== $expected) {
            throw new EmbeddingException(
                sprintf('[gemini] response carries %s embedding item(s), expected %d.', is_array($embeddings) ? count($embeddings) : 'no', $expected),
            );
        }

        $vectors = [];

        foreach (array_values($embeddings) as $i => $item) {
            $raw = null;

            if (is_array($item) && isset($item['values']) && is_array($item['values'])) {
                $raw = $item['values']; // embeddings[i].values
            } elseif (is_array($item) && isset($item['embedding']['values']) && is_array($item['embedding']['values'])) {
                $raw = $item['embedding']['values']; // embeddings[i].embedding.values (older alias)
            }

            if (! is_array($raw) || $raw === []) {
                throw new EmbeddingException(sprintf('[gemini] response has no usable embedding at position %d.', $i));
            }

            $vector = [];

            foreach (array_values($raw) as $component) {
                if (! is_int($component) && ! is_float($component)) {
                    throw new EmbeddingException(sprintf('[gemini] embedding at position %d contains a non-numeric component.', $i));
                }

                $vector[] = (float) $component;
            }

            $vectors[] = $vector;
        }

        return new EmbeddingResult(
            vectors: $vectors,
            model: $this->model(),
            dimensions: count($vectors[0]),
        );
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
