<?php

namespace Tests\Feature\RecipeDedup;

use App\Services\RecipeDedup\Vector\QdrantVectorStore;
use App\Services\RecipeDedup\VectorStoreException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class QdrantVectorStoreTest extends TestCase
{
    public function test_upsert_posts_one_point_per_recipe_with_integer_id(): void
    {
        Http::fake(fn () => Http::response(['result' => ['status' => 'completed']], 200));

        $this->store()->upsertMany([
            ['id' => 7, 'vector' => [0.1, 0.2, 0.3], 'payload' => ['recipe_id' => 7, 'dish_family' => 'pasta']],
            ['id' => 8, 'vector' => [0.4, 0.5, 0.6], 'payload' => ['recipe_id' => 8, 'dish_family' => 'soup']],
        ]);

        // URL shape: /collections/<name>/points?wait=true
        Http::assertSent(function ($request): bool {
            return $request->method() === 'POST'
                && str_contains((string) $request->url(), '/collections/recipe_embeddings/points')
                && str_contains((string) $request->url(), 'wait=true');
        });

        $posted = $this->sentBodies('POST', 'points?wait=true');
        $this->assertCount(1, $posted); // 2 points, chunk limit 200 → one POST

        $points = $posted[0]['points'];
        $this->assertCount(2, $points);
        $this->assertSame(7, $points[0]['id']); // integer point id (= recipe id)
        $this->assertSame([0.1, 0.2, 0.3], $points[0]['vector']);
        $this->assertSame(['recipe_id' => 7, 'dish_family' => 'pasta'], $points[0]['payload']);
        $this->assertSame(8, $points[1]['id']);
    }

    public function test_ensure_collection_creates_the_collection_when_missing(): void
    {
        // Existence probe 404s → PUT create with the exact vector size.
        Http::fake([
            '*/collections/recipe_embeddings' => Http::sequence()
                ->push(['status' => 'not found'], 404)
                ->push(['result' => 'ok'], 200),
        ]);

        $this->store()->ensureCollection(32);

        $puts = $this->sentBodies('PUT', '/collections/recipe_embeddings');
        $this->assertCount(1, $puts);
        $this->assertSame(['size' => 32, 'distance' => 'Cosine'], $puts[0]['vectors']);
    }

    public function test_ensure_collection_is_a_noop_when_the_collection_exists(): void
    {
        // Existence probe 200s → return; NO create PUT (idempotent).
        Http::fake([
            '*/collections/recipe_embeddings' => Http::response(['result' => ['status' => 'green']], 200),
        ]);

        $this->store()->ensureCollection(32);
        $this->store()->ensureCollection(64); // second probe, same story

        $this->assertCount(2, $this->sentBodies('GET', '/collections/recipe_embeddings'));
        Http::assertSent(fn ($request): bool => $request->method() !== 'PUT');
    }

    public function test_ensure_collection_throws_on_probe_failure(): void
    {
        Http::fake([
            '*/collections/recipe_embeddings' => Http::response(['err' => 'boom'], 500),
        ]);

        $this->expectException(VectorStoreException::class);
        $this->expectExceptionMessage('boom');

        $this->store()->ensureCollection(32);
    }

    public function test_search_builds_qdrant_filters_and_maps_payload_results(): void
    {
        Http::fake(fn () => Http::response([
            'result' => [
                ['score' => 0.91, 'payload' => ['recipe_id' => 3, 'dish_family' => 'pasta']],
                ['score' => 0.72, 'payload' => ['recipe_id' => 9, 'dish_family' => 'pasta']],
                ['score' => 0.44, 'payload' => []], // payload-less hit is dropped
            ],
        ], 200));

        $hits = $this->store()->search([0.1, 0.2], 5, ['dish_family' => 'pasta']);

        $this->assertSame([
            ['recipe_id' => 3, 'score' => 0.91],
            ['recipe_id' => 9, 'score' => 0.72],
        ], $hits);

        $bodies = $this->sentBodies('POST', '/points/search');
        $this->assertCount(1, $bodies);
        $this->assertSame([['key' => 'dish_family', 'match' => ['value' => 'pasta']]], $bodies[0]['filter']['must']);
        $this->assertTrue($bodies[0]['with_payload']);
        $this->assertSame(5, $bodies[0]['limit']);
        $this->assertSame([0.1, 0.2], $bodies[0]['vector']);
    }

    public function test_search_without_filters_omits_the_filter_key(): void
    {
        Http::fake(fn () => Http::response(['result' => []], 200));

        $this->assertSame([], $this->store()->search([0.1, 0.2], 3));

        $body = $this->sentBodies('POST', '/points/search')[0];
        $this->assertArrayNotHasKey('filter', $body);
    }

    public function test_upsert_500_response_throws_vector_store_exception(): void
    {
        Http::fake(fn () => Http::response(['err' => 'kaput'], 500));

        $this->expectException(VectorStoreException::class);
        $this->expectExceptionMessage('kaput');

        $this->store()->upsertMany([
            ['id' => 1, 'vector' => [0.0], 'payload' => ['recipe_id' => 1]],
        ]);
    }

    public function test_search_4xx_response_throws_vector_store_exception(): void
    {
        Http::fake(fn () => Http::response(['err' => 'bad collection'], 400));

        $this->expectException(VectorStoreException::class);

        $this->store()->search([0.1], 5);
    }

    public function test_ping_reflects_a_healthy_daemon(): void
    {
        Http::fake(fn () => Http::response(['version' => '1.9'], 200));

        $this->assertTrue($this->store()->ping());
    }

    public function test_ping_is_false_on_error_statuses(): void
    {
        Http::fake(fn () => Http::response('', 503));

        $this->assertFalse($this->store()->ping()); // and it never throws
    }

    public function test_ping_is_false_on_transport_failure(): void
    {
        // Transport-level failure: connection refused / timeout.
        Http::fake(fn () => throw new ConnectionException('cURL error 7: connection refused'));

        $this->assertFalse($this->store()->ping()); // and it never throws
    }

    public function test_api_key_is_sent_as_bearer_token(): void
    {
        Http::fake(fn () => Http::response(['version' => '1.9'], 200));

        $this->store()->ping();

        Http::assertSent(function ($request): bool {
            return $request->header('Authorization') === ['Bearer secret-key'];
        });
    }

    public function test_no_api_key_omits_the_authorization_header(): void
    {
        Http::fake(fn () => Http::response(['version' => '1.9'], 200));

        $this->store(['api_key' => ''])->ping();

        Http::assertSent(fn ($request): bool => $request->header('Authorization') === []);
    }

    public function test_upserts_are_chunked_at_200_points(): void
    {
        Http::fake(fn () => Http::response(['result' => ['status' => 'completed']], 200));

        $points = [];

        foreach (range(1, 250) as $id) {
            $points[] = ['id' => $id, 'vector' => [(float) $id], 'payload' => ['recipe_id' => $id]];
        }

        $this->store()->upsertMany($points);

        $posted = $this->sentBodies('POST', 'points?wait=true');
        $this->assertCount(2, $posted); // 250 points → 200 + 50

        $this->assertCount(200, $posted[0]['points']);
        $this->assertSame(1, $posted[0]['points'][0]['id']);
        $this->assertSame(200, $posted[0]['points'][199]['id']);
        $this->assertCount(50, $posted[1]['points']);
        $this->assertSame(201, $posted[1]['points'][0]['id']);
        $this->assertSame(250, $posted[1]['points'][49]['id']);
    }

    public function test_empty_upsert_and_collection_name_helpers(): void
    {
        Http::fake();

        $this->store()->upsertMany([]); // no requests, no error
        $this->assertSame('recipe_embeddings', $this->store()->collection());
        $this->assertTrue($this->store()->enabled());
        $this->assertFalse($this->store(['url' => ''])->enabled());
    }

    /**
     * Collect the decoded JSON bodies of requests matching method + URL piece.
     *
     * @return list<array<string, mixed>>
     */
    private function sentBodies(string $method, string $urlPiece): array
    {
        return Http::recorded()
            ->filter(fn (array $pair): bool => $pair[0]->method() === $method
                && str_contains((string) $pair[0]->url(), $urlPiece))
            ->map(fn (array $pair) => $pair[0]->data())
            ->values()
            ->all();
    }

    /**
     * The standard store config (mirrors config('recipe_dedup.vector.qdrant')
     * with the DEDUP_QDRANT_* defaults; timeouts are ms).
     *
     * @param  array<string, mixed>  $overrides
     */
    private function store(array $overrides = []): QdrantVectorStore
    {
        return new QdrantVectorStore(array_merge([
            'url' => 'http://qdrant.test:6333',
            'api_key' => 'secret-key',
            'collection' => 'recipe_embeddings',
            'timeout' => 1500,
            'connect_timeout' => 700,
        ], $overrides));
    }
}
