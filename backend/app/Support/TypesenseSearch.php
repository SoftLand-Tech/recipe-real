<?php

namespace App\Support;

use App\Http\Resources\RecipeCardResource;
use App\Models\Recipe;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Thin Typesense HTTP client for the bilingual recipe search index (no
 * composer package — Laravel's Http facade only).
 *
 * Disabled mode: an empty TYPESENSE_API_KEY turns every method into a
 * no-op (enabled() false), so local dev without the daemon behaves exactly
 * like before this class existed. When enabled but unreachable/slow, calls
 * throw and CALLERS fall back to the FTS5 path (search must never 500).
 */
class TypesenseSearch
{
    /**
     * Search fields + weights (10/10 titles, 4/4 ingredients, 2 category)
     * — one place, shared by searchRecipes() and the docblock map.
     */
    private const QUERY_BY = 'title,title_ar,ingredients,ingredients_ar,category';

    private const QUERY_BY_WEIGHTS = '10,10,4,4,2';

    /**
     * Circuit breaker: while this key is cached, search() throws before
     * attempting ANY HTTP call — a down daemon costs one fallback, not one
     * per request until the TTL expires. Any search-path failure (transport
     * error, timeout, non-2xx) opens it; successful queries never do.
     */
    private const CIRCUIT_OPEN_KEY = 'typesense.circuit_open';

    private const CIRCUIT_OPEN_TTL_SECONDS = 60;

    /**
     * Collection name, overridable via config for staging isolation.
     */
    public function collection(): string
    {
        return (string) config('recipereal.typesense.collection', 'recipes');
    }

    /**
     * False when no API key is configured: the whole feature is off.
     */
    public function enabled(): bool
    {
        return trim((string) config('recipereal.typesense.api_key', '')) !== '';
    }

    /**
     * Create the recipes collection when missing. Returns true when the
     * collection exists afterwards, false on any failure (logged).
     */
    public function ensureCollection(): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            $exists = $this->get("collections/{$this->collection()}")->successful();

            if ($exists) {
                return true;
            }
        } catch (Throwable) {
            // 404 surfaces as a failed status; connection errors fall through
            // to the create attempt below and fail there with context.
        }

        // title_ar gets Typesense's Arabic locale for proper stemming/
        // tokenization. Older daemons reject unknown locales — retry without
        // the key so indexing still works (plain tokenization).
        $fields = $this->schemaFields();

        try {
            $response = $this->post('collections', ['name' => $this->collection(), 'fields' => $fields]);

            if ($response->successful()) {
                return true;
            }

            // A 409 here means another worker created it first — fine.
            if ($response->status() === 409) {
                return true;
            }

            // Locale rejected by the server? Drop locale keys and retry once.
            $titleAr = array_values(array_filter(
                $fields,
                fn (array $field) => ($field['name'] ?? '') === 'title_ar' && isset($field['locale'])
            ));

            if ($titleAr !== []) {
                Log::warning('typesense.ensure_collection.locale_rejected', [
                    'body' => (string) $response->body(),
                ]);

                foreach ($fields as &$field) {
                    unset($field['locale']);
                }
                unset($field);

                return $this->post('collections', ['name' => $this->collection(), 'fields' => $fields])->successful();
            }

            Log::warning('typesense.ensure_collection.failed', ['body' => (string) $response->body()]);

            return false;
        } catch (Throwable $e) {
            Log::warning('typesense.ensure_collection.error', ['error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Drop the whole collection (--fresh reindex). Returns true when the
     * server confirmed the delete (also true on 404 — already gone).
     */
    public function dropCollection(): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            $status = $this->delete('collections/'.$this->collection())->status();

            return $status === 200 || $status === 404;
        } catch (Throwable $e) {
            Log::warning('typesense.drop_collection.error', ['error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Index-time document shape from a Recipe model — THE one payload
     * builder. `minutes` is COALESCE(reality, community_avg, publisher);
     * list fields are joined strings; category is stored lowercased so the
     * exact-match filter stays case-insensitive.
     *
     * @return array<string, mixed>
     */
    public function documentFor(Recipe $recipe): array
    {
        $ingredients = is_array($recipe->ingredients) ? $recipe->ingredients : [];
        $ingredientsAr = is_array($recipe->ingredients_ar) ? $recipe->ingredients_ar : [];

        return [
            'id' => (string) $recipe->id,
            'title' => (string) ($recipe->title ?? ''),
            'title_ar' => (string) ($recipe->title_ar ?? ''),
            'ingredients' => implode(' ', array_map('strval', $ingredients)),
            'ingredients_ar' => implode(' ', array_map('strval', $ingredientsAr)),
            'category' => mb_strtolower(trim((string) ($recipe->category ?? ''))),
            'keywords' => implode(' ', array_map(
                'strval',
                is_array($recipe->keywords) ? $recipe->keywords : []
            )),
            'image_url' => (string) ($recipe->image_url ?? ''),
            'has_image' => trim((string) ($recipe->image_url ?? '')) !== '',
            'steps_count' => (int) ($recipe->steps_count ?? 0),
            'rating' => $recipe->aggregated_rating !== null ? (float) $recipe->aggregated_rating : null,
            'minutes' => (int) round((float) (
                $recipe->reality_minutes
                    ?? $recipe->community_avg_minutes
                    ?? $recipe->publisher_time_minutes
                    ?? 0
            )),
        ];
    }

    /**
     * Upsert documents (Typesense import action=upsert). Returns true on
     * success, false on failure (logged); never throws.
     *
     * @param  list<array<string, mixed>>  $docs  output of documentFor()
     */
    public function upsertDocs(array $docs): bool
    {
        if (! $this->enabled() || $docs === []) {
            return false;
        }

        $lines = '';
        foreach ($docs as $doc) {
            $lines .= json_encode($doc, JSON_UNESCAPED_UNICODE)."\n";
        }

        try {
            // Raw NDJSON body: PendingRequest::post() JSON-encodes string
            // payloads, which would double-encode the JSON lines.
            $response = $this->client()
                ->withBody($lines, 'text/plain')
                ->acceptJson()
                ->post("collections/{$this->collection()}/documents/import?action=upsert");

            if ($response->successful()) {
                return true;
            }

            Log::warning('typesense.import.failed', ['body' => (string) $response->body()]);
        } catch (Throwable $e) {
            Log::warning('typesense.import.error', ['error' => $e->getMessage()]);
        }

        return false;
    }

    /**
     * Remove one document by id (recipe deleted). Never throws; returns
     * whether the delete succeeded (false when disabled — nothing to sync).
     */
    public function deleteDoc(string|int $id): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            return $this->delete("collections/{$this->collection()}/documents/{$id}")->successful();
        } catch (Throwable $e) {
            Log::warning('typesense.delete.error', ['id' => $id, 'error' => $e->getMessage()]);

            return false;
        }
    }

    /**
     * Recipe search via Typesense, mapped onto /api/recipes/search's
     * contract. Returns a LengthAwarePaginator of Recipe models in
     * Typesense hit order (the controller wraps it in RecipeCardResource —
     * identical envelope to the FTS5 path), or null when the feature is
     * disabled so the caller can fall through. Throws on transport errors
     * and non-2xx responses (caller falls back + logs).
     *
     * Mapping (API param → Typesense param):
     *   q            → q (empty string becomes "*" so browse-style calls
     *                  with filters only still work)
     *   query_by     → title,title_ar,ingredients,ingredients_ar,category
     *   weights      → query_by_weights 10,10,4,4,2
     *   category     → filter_by "category:=X" (stored lowercased)
     *   max_time     → filter_by "minutes:<=X" (minutes = COALESCE(reality,
     *                  community_avg, publisher) at index time)
     *   relevance    → sort_by "_text_match:desc,rating:desc"
     *   top_rated    → sort_by "rating:desc,_text_match:desc"
     *   fastest      → sort_by "minutes:asc,_text_match:desc"
     *   most_loved   → approximated as rating order (no review_count in
     *                  the index); falls back to relevance when q is empty
     *   page/per_page→ page/per_page
     *
     * @return LengthAwarePaginator<Recipe>|null
     *
     * @throws Throwable
     */
    public function searchRecipes(
        string $q,
        string $category = '',
        ?int $timeMax = null,
        string $sort = '',
        int $page = 1,
        int $perPage = 20
    ): ?LengthAwarePaginator {
        if (! $this->enabled()) {
            return null;
        }

        if ($sort === 'fastest') {
            // Fastest is a utility sort: minutes lead, photos break ties
            // within each minute bucket.
            $sortBy = 'minutes:asc,has_image:desc,_text_match:desc';
        } elseif ($sort === 'most_loved' || $sort === 'top_rated') {
            // EXPLICIT rating sorts are the user's exception: pure rating
            // order, no image bias (image recipes don't get to skip queue).
            $sortBy = 'rating:desc,_text_match:desc';
        } elseif ($q === '*') {
            // Default grid (no query): photos first, then rating — the
            // product rule for every default list.
            $sortBy = 'has_image:desc,rating:desc';
        } else {
            // Search relevance: photos lead per the product rule, text
            // match orders within each photo group, rating breaks ties.
            $sortBy = 'has_image:desc,_text_match:desc,rating:desc';
        }

        $params = [
            'q' => $q,
            'query_by' => self::QUERY_BY,
            'query_by_weights' => self::QUERY_BY_WEIGHTS,
            'sort_by' => $sortBy,
            'page' => max(1, $page),
            'per_page' => $perPage,
        ];

        $filters = [];
        $category = $this->sanitizedCategory($category);
        if ($category !== '') {
            $filters[] = 'category:='.$category;
        }
        if ($timeMax !== null) {
            $filters[] = 'minutes:<='.$timeMax;
        }
        if ($filters !== []) {
            $params['filter_by'] = implode(' && ', $filters);
        }

        $body = $this->search($params);

        $ids = array_map(
            static fn (array $hit): string => (string) ($hit['document']['id'] ?? ''),
            $body['hits'] ?? []
        );

        // Map hits back to Eloquent models preserving Typesense's ranking
        // order; missing rows (deleted since indexing) drop out silently —
        // the nightly reindex heals the drift.
        $found = (int) ($body['found'] ?? count($ids));
        $recipes = Recipe::query()
            // Card columns only — the caller wraps in RecipeCardResource,
            // so SELECT * would drag heavy TEXT/JSON columns for nothing.
            ->select(RecipeCardResource::COLUMNS)
            ->whereIn('id', $ids)
            ->get()
            ->sortBy(fn (Recipe $recipe) => array_search((string) $recipe->id, $ids, true))
            ->values();

        return new LengthAwarePaginator(
            $recipes,
            $found,
            $perPage,
            max(1, $page),
        );
    }

    /**
     * Run a search against the collection. Throws on any transport error
     * (timeout/connection) or non-2xx response — the caller decides how to
     * degrade. Circuit breaker: every such failure caches the
     * typesense.circuit_open flag for 60s, and while the flag is present
     * this method throws BEFORE attempting any HTTP call (same exception
     * contract, so RecipeController's catch falls straight through to the
     * FTS5 path without burning the timeout budget). Returns the decoded
     * JSON body: {found, page, hits: [{document: {...}}, ...]}.
     *
     * @param  array<string, mixed>  $params
     * @return array{found?: int, page?: int, hits?: list<array<string, mixed>>}
     */
    public function search(array $params): array
    {
        if (Cache::has(self::CIRCUIT_OPEN_KEY)) {
            throw new ConnectionException(
                'Typesense circuit open — failing fast to the FTS5 fallback.'
            );
        }

        try {
            $response = $this->get(
                "collections/{$this->collection()}/documents/search",
                $params
            );
        } catch (Throwable $e) {
            $this->openCircuit();

            throw $e;
        }

        if (! $response->successful()) {
            $this->openCircuit();

            throw new ConnectionException(
                "Typesense search failed with HTTP {$response->status()}."
            );
        }

        /** @var array{found?: int, page?: int, hits?: list<array<string, mixed>>} $body */
        return $response->json() ?? [];
    }

    /**
     * Open the search circuit breaker for the TTL. Never called on the
     * write/admin paths (upsert/delete/ensure) — those swallow their own
     * failures and must keep syncing when the daemon comes back.
     */
    private function openCircuit(): void
    {
        Cache::put(self::CIRCUIT_OPEN_KEY, true, self::CIRCUIT_OPEN_TTL_SECONDS);
    }

    /**
     * Typesense's filter_by is a small expression language (field:value,
     * &&, ||, comparisons) — a raw category straight off the query string
     * could smuggle operators into it (M5 filter injection). Strip the
     * operator/backtick characters, normalize case/whitespace, then apply
     * a final strict allowlist shaped like the index-time categories
     * (documentFor lowercases + trims). Anything empty or invalid drops
     * the category filter entirely — browse-all for that facet beats
     * erroring the whole search.
     */
    private function sanitizedCategory(string $category): string
    {
        $category = mb_strtolower(trim($category));

        // Operator + structural characters first: backticks, colons, the
        // && / || connectors and every comparison character.
        $category = str_replace(['`', ':', '||', '&&', '<', '>', '='], '', $category);
        $category = trim((string) preg_replace('/\s+/', ' ', $category));

        if ($category === '') {
            return '';
        }

        return preg_match("/^[a-z0-9][a-z0-9 &'-]{0,59}$/", $category) === 1
            ? $category
            : '';
    }

    /**
     * Schema field list shared by ensureCollection's two attempts.
     *
     * @return list<array<string, mixed>>
     */
    private function schemaFields(): array
    {
        return [
            ['name' => 'title', 'type' => 'string'],
            ['name' => 'title_ar', 'type' => 'string', 'locale' => 'ar'],
            ['name' => 'ingredients', 'type' => 'string'],
            ['name' => 'ingredients_ar', 'type' => 'string'],
            ['name' => 'category', 'type' => 'string', 'facet' => true],
            ['name' => 'keywords', 'type' => 'string'],
            ['name' => 'image_url', 'type' => 'string', 'index' => false],
            // UI-first ordering: photo recipes lead every default list; the
            // explicit top_rated/most_loved sorts stay pure rating order.
            ['name' => 'has_image', 'type' => 'bool', 'sortable' => true],
            ['name' => 'minutes', 'type' => 'int32', 'filterable' => true, 'sortable' => true],
            ['name' => 'rating', 'type' => 'float', 'optional' => true, 'sortable' => true],
            ['name' => 'steps_count', 'type' => 'int32', 'optional' => true],
        ];
    }

    /**
     * Shared JSON client: base URL + X-TYPESENSE-API-KEY + tight timeouts
     * (1.5s total / 700ms connect by default — a slow daemon costs less
     * than the FTS5 fallback it replaces).
     */
    private function client()
    {
        return Http::baseUrl($this->baseUri())
            ->withHeaders(['X-TYPESENSE-API-KEY' => (string) config('recipereal.typesense.api_key')])
            ->timeout((int) config('recipereal.typesense.timeout_ms', 1500) / 1000)
            ->connectTimeout((int) config('recipereal.typesense.connect_timeout_ms', 700) / 1000);
    }

    private function baseUri(): string
    {
        return sprintf(
            'http://%s:%s',
            (string) config('recipereal.typesense.host', '127.0.0.1'),
            (string) config('recipereal.typesense.port', '8108')
        );
    }

    private function get(string $path, array $query = [])
    {
        return $this->client()->acceptJson()->get($path, $query);
    }

    private function post(string $path, $body, array $headers = [])
    {
        return $this->client()
            ->when(
                $headers !== [],
                fn ($http) => $http->withHeaders($headers),
                fn ($http) => $http->acceptJson()
            )
            ->post($path, $body);
    }

    private function delete(string $path)
    {
        return $this->client()->acceptJson()->delete($path);
    }
}
