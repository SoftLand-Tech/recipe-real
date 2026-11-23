<?php

namespace App\Services\RecipeDedup\Vector;

use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\VectorStoreException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Qdrant REST client over the Http facade ONLY — no composer package,
 * following the App\Support\TypesenseSearch house precedent (thin client,
 * tight timeouts, raw JSON payload shapes).
 *
 * Fail-soft policy: HEALTH methods (enabled/ping) never throw; every other
 * method throws VectorStoreException on non-2xx responses and transport
 * errors (message carries the Qdrant host) — EmbeddingService catches it
 * and records row status instead of blowing up the import pipeline.
 */
final class QdrantVectorStore implements VectorStore
{
    /** Points per upsert PUT: Qdrant's own guidance for one upload batch. */
    private const UPSERT_CHUNK = 200;

    public function __construct(private readonly array $config) {}

    public function enabled(): bool
    {
        return filled((string) ($this->config['url'] ?? ''));
    }

    public function collection(): string
    {
        return (string) ($this->config['collection'] ?? 'recipe_embeddings');
    }

    public function ensureCollection(int $dimensions): void
    {
        $name = $this->collection();

        // GET /collections/{name}: existence probe — 200 means present.
        $get = $this->send(fn (): Response => $this->request()->get("collections/{$name}"));

        if ($get->status() === 404) {
            // PUT /collections/{name}: create with the exact vector size.
            $put = $this->send(fn (): Response => $this->request()->put("collections/{$name}", [
                'vectors' => ['size' => $dimensions, 'distance' => 'Cosine'],
            ]));

            if (! $put->successful()) {
                throw new VectorStoreException(
                    sprintf('Qdrant collection create for "%s" failed with HTTP %d: %s', $name, $put->status(), $this->excerpt($put))
                );
            }

            return;
        }

        if ($get->successful()) {
            return; // already there; Qdrant collections cannot be resized in place
        }

        throw new VectorStoreException(
            sprintf('Qdrant collection probe for "%s" failed with HTTP %d: %s', $name, $get->status(), $this->excerpt($get))
        );
    }

    public function upsertMany(array $points): void
    {
        if ($points === []) {
            return;
        }

        // PUT /collections/{name}/points?wait=true: chunked (200/batch) and
        // wait=true makes each upsert synchronous so a following search sees
        // the point. (POST on this path is Qdrant's point-selector endpoint
        // and rejects upsert bodies with HTTP 400 "missing field `ids`".)
        $chunks = array_chunk(array_values($points), self::UPSERT_CHUNK);

        foreach ($chunks as $chunk) {
            $body = [
                'points' => array_map(fn (array $point): array => [
                    'id' => (int) $point['id'], // point id = recipe id, sent as integer
                    'vector' => array_values(array_map('floatval', $point['vector'])),
                    'payload' => is_array($point['payload'] ?? null) ? $point['payload'] : [],
                ], $chunk),
            ];

            $response = $this->send(fn (): Response => $this->request()->put(
                "collections/{$this->collection()}/points?wait=true",
                $body
            ));
            unset($body);

            if (! $response->successful()) {
                throw new VectorStoreException(
                    sprintf('Qdrant upsert failed with HTTP %d: %s', $response->status(), $this->excerpt($response))
                );
            }
        }
    }

    public function search(array $vector, int $limit, array $filters = []): array
    {
        // POST /collections/{name}/points/search: with_payload=true pulls
        // payload.recipe_id back out of the hits.
        $body = [
            'vector' => array_values(array_map('floatval', $vector)),
            'limit' => $limit,
            'with_payload' => true,
        ];

        if ($filters !== []) {
            // Equality filters -> Qdrant filter.must [{key, match:{value}}].
            $must = [];

            foreach ($filters as $key => $value) {
                $must[] = ['key' => (string) $key, 'match' => ['value' => $value]];
            }

            if ($must !== []) {
                $body['filter'] = ['must' => $must];
            }
        }

        $response = $this->send(fn (): Response => $this->request()->post(
            "collections/{$this->collection()}/points/search",
            $body
        ));
        unset($body);

        if (! $response->successful()) {
            throw new VectorStoreException(
                sprintf('Qdrant search failed with HTTP %d: %s', $response->status(), $this->excerpt($response))
            );
        }

        $result = $response->json('result');
        $result = is_array($result) ? $result : [];

        $hits = [];

        foreach (array_values($result) as $hit) {
            $recipeId = is_array($hit) ? ($hit['payload']['recipe_id'] ?? null) : null;
            $score = is_array($hit) ? ($hit['score'] ?? null) : null;

            if ($recipeId === null || $score === null) {
                continue; // payload-less hit (index drift) is not a candidate
            }

            // Qdrant cosine similarity already sits in -1.0..1.0 with higher
            // = closer; passed through untouched. NO cutoff here — slice 4's
            // retriever owns the config-driven min_vector_score.
            $hits[] = ['recipe_id' => (int) $recipeId, 'score' => (float) $score];
        }

        return $hits;
    }

    public function delete(int $recipeId): void
    {
        // POST /collections/{name}/points/delete?wait=true with a points
        // id list — the documented way to drop points by id synchronously.
        $response = $this->send(fn (): Response => $this->request()->post(
            "collections/{$this->collection()}/points/delete?wait=true",
            ['points' => [$recipeId]]
        ));

        if (! $response->successful()) {
            throw new VectorStoreException(
                sprintf('Qdrant delete of point %d failed with HTTP %d: %s', $recipeId, $response->status(), $this->excerpt($response))
            );
        }
    }

    public function ping(): bool
    {
        // GET / (Qdrant answers with version info): true on 2xx regardless
        // of body, false on EVERYTHING else (transport errors included) —
        // this is the one method that must never throw.
        try {
            return $this->send(fn (): Response => $this->request()->get('/'))->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Shared JSON client: base URL + Bearer token (header omitted when no
     * key is configured, mirroring TypesenseSearch) + the configured
     * millisecond timeouts converted to seconds (Guzzle wants seconds;
     * every DEDUP_* timeout config keeps its ms unit).
     */
    private function request()
    {
        $url = rtrim((string) ($this->config['url'] ?? ''), '/');

        if ($url === '') {
            // A missed enabled() check should fail loudly and clearly — but
            // still through the one exception type the contract allows.
            throw new VectorStoreException('Qdrant url is not configured (DEDUP_QDRANT_URL) — the vector store is disabled.');
        }

        $apiKey = (string) ($this->config['api_key'] ?? '');

        return Http::baseUrl($url)
            ->acceptJson()
            ->when($apiKey !== '', fn ($http) => $http->withToken($apiKey))
            ->timeout(max(1, (int) ($this->config['timeout'] ?? 1500)) / 1000)
            ->connectTimeout(max(1, (int) ($this->config['connect_timeout'] ?? 700)) / 1000);
    }

    /**
     * Wrap EVERY request round: transport errors (connection refused,
     * timeout, DNS) must leave as VectorStoreException with the host named
     * — never as raw Http client exceptions.
     *
     * @param  callable(): Response  $call
     */
    private function send(callable $call): Response
    {
        try {
            return $call();
        } catch (\Throwable $e) {
            throw new VectorStoreException(
                'Qdrant connection error (host '.$this->host().'): '.$e->getMessage(),
                0,
                $e,
            );
        }
    }

    /** Qdrant host for diagnostics (transport errors embed it). */
    private function host(): string
    {
        return (string) (parse_url((string) ($this->config['url'] ?? ''), PHP_URL_HOST) ?: 'unknown');
    }

    /** First 300 chars of an error body — enough to diagnose a bad payload. */
    private function excerpt(Response $response): string
    {
        return mb_substr(trim((string) $response->body()), 0, 300);
    }
}
