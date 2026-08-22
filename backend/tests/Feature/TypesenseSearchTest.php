<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Models\User;
use App\Support\TypesenseSearch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * Typesense-backed /api/recipes/search with graceful FTS5 fallback:
 *
 *   1. Enabled + healthy: collection bootstrap (with locale-retry),
 *      write-through upserts, hit-order preservation in the response and
 *      the exact query params the mapping table promises (query_by +
 *      weights, filter_by category/time, sort_by variants).
 *   2. Fallbacks: a connection error and an HTTP 500 both degrade to the
 *      unchanged FTS5 path with the same envelope, logging a warning and
 *      never surfacing a 500.
 *   3. Disabled (empty TYPESENSE_API_KEY): zero HTTP attempted, FTS5
 *      serves the request.
 *   4. Write-through sync on user-recipe create/update/delete, which must
 *      never fail the request when the daemon misbehaves.
 */
class TypesenseSearchTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = 'http://typesense-test:8108';

    private const KEY = 'test-key';

    protected function tearDown(): void
    {
        Http::clearResolvedInstances();
        config()->set('recipereal.typesense.api_key', '');
        parent::tearDown();
    }

    /** Point config at the fake daemon (empty key = disabled). */
    private function enableTypesense(): void
    {
        config()->set('recipereal.typesense.host', 'typesense-test');
        config()->set('recipereal.typesense.port', 8108);
        config()->set('recipereal.typesense.api_key', self::KEY);
    }

    /**
     * Stub every daemon call: collection exists + search returns the given
     * recipe ids in order.
     *
     * @param  list<string>  $hitIds
     */
    private function fakeHealthyDaemon(array $hitIds): void
    {
        Http::fake([
            self::BASE.'/collections/recipes/documents/search*' => Http::response($this->searchBody($hitIds)),
            '*' => Http::response(['ok' => true]),
        ]);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, mixed>
     */
    private function searchBody(array $ids): array
    {
        return [
            'found' => count($ids),
            'page' => 1,
            'hits' => array_map(
                static fn (string $id): array => [
                    'document' => [
                        'id' => $id,
                        'title' => 'Hit '.$id,
                        'category' => 'main dish',
                    ],
                ],
                $ids
            ),
        ];
    }

    private function makeRecipe(array $overrides = []): Recipe
    {
        return Recipe::create(array_merge([
            'title' => 'One-Pan Lemon Chicken',
            'title_ar' => 'دجاج بالليمون',
            'source_type' => 'foodcom',
            'ingredients' => ['lemon', 'chicken', 'olive oil'],
            'ingredients_ar' => json_encode(['ليمون', 'دجاج'], JSON_UNESCAPED_UNICODE),
            'category' => 'Main Dish',
            'keywords' => ['lemon'],
            'image_url' => 'https://example.com/lemon.jpg',
            'steps_count' => 6,
            'aggregated_rating' => 4.5,
            'review_count' => 12,
            'publisher_time_minutes' => 40,
            'community_avg_minutes' => 55,
            'reality_minutes' => 55.25,
            'reality_source' => 'community',
            'reality_samples' => 3,
        ], $overrides));
    }

    // ------------------------------------------------------------------
    // Service-level behavior
    // ------------------------------------------------------------------

    public function test_ensure_collection_creates_with_arabic_locale_and_retries_without_it_when_rejected(): void
    {
        $this->enableTypesense();

        Http::fake([
            // Collection missing…
            self::BASE.'/collections/recipes' => Http::sequence()
                ->push(['message' => 'Not Found'], 404)
                // …and after creation, the health probe succeeds.
                ->push(['name' => 'recipes']),
            self::BASE.'/collections' => Http::sequence()
                ->push(['message' => 'Bad locale "ar"'], 400)
                ->push(['name' => 'recipes'], 201),
        ]);

        $service = new TypesenseSearch;

        $this->assertTrue($service->ensureCollection());

        $createCalls = collect(Http::recorded())
            ->filter(fn (array $pair) => str_ends_with($pair[0]->url(), '/collections'))
            ->values();

        $this->assertSame(2, $createCalls->count(), 'expected locale attempt + retry');

        [$first, $second] = $createCalls->map(fn (array $pair) => $pair[0]->data())->all();

        $titleArFirst = collect($first['fields'])->firstWhere('name', 'title_ar');
        $titleArSecond = collect($second['fields'])->firstWhere('name', 'title_ar');

        $this->assertSame('ar', $titleArFirst['locale']);
        $this->assertArrayNotHasKey('locale', $titleArSecond);
    }

    public function test_upsert_docs_sends_jsonl_payload_with_coerced_types(): void
    {
        $this->enableTypesense();
        Http::fake(['*' => Http::response([['success' => true]], 200)]);

        $recipe = $this->makeRecipe();
        (new TypesenseSearch)->upsertDocs([(new TypesenseSearch)->documentFor($recipe)]);

        $request = Http::recorded()[0][0];

        $this->assertSame('POST', $request->method());
        $this->assertStringContainsString(
            '/collections/recipes/documents/import?action=upsert',
            $request->url()
        );
        $this->assertSame(self::KEY, $request->header('X-TYPESENSE-API-KEY')[0]);

        $lines = explode("\n", trim($request->body()));
        $doc = json_decode($lines[0], true);

        $this->assertSame((string) $recipe->id, $doc['id']);
        $this->assertSame('One-Pan Lemon Chicken', $doc['title']);
        $this->assertSame('دجاج بالليمون', $doc['title_ar']);
        $this->assertSame('lemon chicken olive oil', $doc['ingredients']);
        $this->assertSame('main dish', $doc['category']);
        $this->assertSame(55, $doc['minutes']);
        $this->assertSame(4.5, $doc['rating']);
        $this->assertSame(6, $doc['steps_count']);
    }

    // ------------------------------------------------------------------
    // Search endpoint: enabled path
    // ------------------------------------------------------------------

    public function test_search_maps_hits_to_recipes_preserving_typesense_order(): void
    {
        $this->enableTypesense();

        // Created deliberately out of "rank" order. NOTE: Http::fake() is
        // STICKY — a second call does NOT replace the first — so the real
        // hit list must be in the ONE fake registered for this test.
        $c = $this->makeRecipe(['title' => 'C Recipe']);
        $a = $this->makeRecipe(['title' => 'A Recipe']);
        $b = $this->makeRecipe(['title' => 'B Recipe']);

        // Daemon ranks B, A, C.
        Http::fake([
            self::BASE.'/collections/recipes/documents/search*' =>
                Http::response($this->searchBody([(string) $b->id, (string) $a->id, (string) $c->id])),
            '*' => Http::response(['ok' => true]),
        ]);

        $response = $this->getJson('/api/recipes/search?q=recipe');
        $response->assertOk();

        $ids = collect($response->json('data'))->pluck('id')->all();
        $this->assertSame([$b->id, $a->id, $c->id], $ids);

        // Same meta envelope as the FTS5 paginator.
        $meta = $response->json('meta');
        $this->assertSame(1, $meta['current_page']);
        $this->assertSame(3, $meta['total']);
        $this->assertSame(20, $meta['per_page']);
    }

    public function test_search_sends_query_by_weights_filters_and_default_sort(): void
    {
        $this->enableTypesense();
        $this->fakeHealthyDaemon([]);

        $response = $this->getJson('/api/recipes/search?q=pasta&category=Main%20Dish&max_time=30&page=2&per_page=5');
        $response->assertOk();

        $request = Http::recorded()[0][0];
        $query = [];

        parse_str(parse_url($request->url(), PHP_URL_QUERY), $query);

        $this->assertSame('pasta', $query['q']);
        $this->assertSame('title,title_ar,ingredients,ingredients_ar,category', $query['query_by']);
        $this->assertSame('10,10,4,4,2', $query['query_by_weights']);
        $this->assertSame('_text_match:desc,rating:desc', $query['sort_by']);
        $this->assertSame('category:=main dish && minutes:<=30', $query['filter_by']);
        $this->assertSame('2', $query['page']);
        $this->assertSame('5', $query['per_page']);
    }

    public function test_fastest_sort_maps_to_minutes_then_text_match(): void
    {
        $this->enableTypesense();
        $this->fakeHealthyDaemon([]);

        $this->getJson('/api/recipes/search?q=soup&sort=fastest')->assertOk();

        $request = Http::recorded()[0][0];
        $query = [];
        parse_str(parse_url($request->url(), PHP_URL_QUERY), $query);

        $this->assertSame('minutes:asc,_text_match:desc', $query['sort_by']);
    }

    public function test_empty_q_becomes_wildcard_and_sorts_by_rating(): void
    {
        $this->enableTypesense();
        $this->fakeHealthyDaemon([]);

        $this->getJson('/api/recipes/search?max_time=15')->assertOk();

        $request = Http::recorded()[0][0];
        $query = [];
        parse_str(parse_url($request->url(), PHP_URL_QUERY), $query);

        $this->assertSame('*', $query['q']);
        $this->assertSame('rating:desc,_text_match:desc', $query['sort_by']);
        $this->assertSame('minutes:<=15', $query['filter_by']);
    }

    // ------------------------------------------------------------------
    // Fallbacks
    // ------------------------------------------------------------------

    public function test_connection_error_falls_back_to_fts5_with_same_shape(): void
    {
        $this->enableTypesense();
        Http::fake(fn (): never => throw Http::failedConnection('Connection refused'));

        $this->makeRecipe(['title' => 'Butter Chicken', 'steps_count' => 4]);

        Log::spy();

        $response = $this->getJson('/api/recipes/search?q=chicken');
        $response->assertOk();

        // FTS5 result set, identical envelope.
        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Butter Chicken', $titles);

        Log::shouldHaveReceived('warning')
            ->once()
            ->withArgs(fn (...$args) => str_contains((string) ($args[0] ?? ''), 'typesense.search.fallback'));
    }

    public function test_http_error_response_falls_back_to_fts5(): void
    {
        $this->enableTypesense();
        Http::fake(['*' => Http::response(['message' => 'boom'], 500)]);

        $this->makeRecipe(['title' => 'Beef Stew', 'steps_count' => 4]);

        $response = $this->getJson('/api/recipes/search?q=stew');
        $response->assertOk();

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Beef Stew', $titles);
    }

    public function test_disabled_feature_attempts_no_http_and_serves_fts5(): void
    {
        // Key stays empty — the default dev posture.
        Http::fake(['*' => Http::response(['should', 'never', 'happen'])]);

        $this->makeRecipe(['title' => 'Shakshuka', 'steps_count' => 4]);

        $response = $this->getJson('/api/recipes/search?q=shakshuka');
        $response->assertOk();

        $titles = collect($response->json('data'))->pluck('title')->all();
        $this->assertContains('Shakshuka', $titles);

        $this->assertCount(0, Http::recorded(), 'no HTTP calls may be attempted while disabled');
    }

    // ------------------------------------------------------------------
    // Write-through sync
    // ------------------------------------------------------------------

    public function test_user_recipe_create_updates_and_deletes_sync_to_typesense(): void
    {
        $user = User::factory()->create();
        $this->enableTypesense();
        Http::fake(['*' => Http::response([['success' => true]], 200)]);

        // CREATE
        $created = $this->actingAs($user, 'sanctum')->postJson('/api/recipes', [
            'title' => 'My Garlic Pasta',
            'estimated_minutes' => 20,
            'ingredients' => ['garlic', 'pasta'],
            'steps' => [
                ['description' => 'Boil pasta'],
                ['description' => 'Toss with garlic'],
            ],
        ]);
        $created->assertCreated();
        $recipeId = $created->json('data.id');

        $imports = collect(Http::recorded())
            ->filter(fn (array $pair) => str_contains($pair[0]->url(), '/documents/import'));
        $this->assertSame(1, $imports->count(), 'create must upsert exactly one doc');

        $importDoc = json_decode(trim($imports->first()[0]->body()), true);
        $this->assertSame((string) $recipeId, $importDoc['id']);
        $this->assertSame('My Garlic Pasta', $importDoc['title']);

        Http::fake(['*' => Http::response([['success' => true]], 200)]);

        // UPDATE
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/recipes/{$recipeId}", ['title' => 'My Renamed Pasta'])
            ->assertOk();

        $imports = collect(Http::recorded())
            ->filter(fn (array $pair) => str_contains($pair[0]->url(), '/documents/import'));
        $this->assertSame(1, $imports->count(), 'update must re-upsert the doc');

        $importDoc = json_decode(trim($imports->first()[0]->body()), true);
        $this->assertSame('My Renamed Pasta', $importDoc['title']);

        // DELETE
        Http::fake(['*' => Http::response(['ok' => true])]);
        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/recipes/{$recipeId}")
            ->assertNoContent();

        $deletes = collect(Http::recorded())
            ->filter(fn (array $pair) => str_ends_with(
                parse_url($pair[0]->url(), PHP_URL_PATH) ?? '',
                "/documents/{$recipeId}"
            ));
        $this->assertSame(1, $deletes->count(), 'delete must remove the doc');
        $this->assertSame('DELETE', $deletes->first()[0]->method());
    }

    public function test_write_through_failure_never_fails_the_request(): void
    {
        $user = User::factory()->create();
        $this->enableTypesense();
        Http::fake(fn (): never => throw Http::failedConnection('Connection refused'));

        Log::spy();

        $created = $this->actingAs($user, 'sanctum')->postJson('/api/recipes', [
            'title' => 'Resilient Soup',
            'estimated_minutes' => 15,
            'ingredients' => ['water', 'salt'],
            'steps' => [['description' => 'Boil']],
        ]);

        // The write itself succeeded despite the dead daemon.
        $created->assertCreated();
        $this->assertSame('Resilient Soup', $created->json('data.title'));

        // The service logs typesense.import.error itself; the controller
        // wrapper only adds op/recipe_id context.
        Log::shouldHaveReceived('warning')
            ->withArgs(fn (...$args) => str_contains((string) ($args[0] ?? ''), 'typesense.import.error'));
    }
}
