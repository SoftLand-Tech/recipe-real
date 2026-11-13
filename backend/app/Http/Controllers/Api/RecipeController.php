<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeCardResource;
use App\Http\Resources\RecipeResource;
use App\Jobs\RecordRecipeView;
use App\Models\Recipe;
use App\Support\CommunityFeedCache;
use App\Support\RecipeFtsIndex;
use App\Support\TypesenseSearch;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class RecipeController extends Controller
{
    /**
     * Allowed /search sort orders (relevance needs a q, else it degrades).
     */
    private const SEARCH_SORTS = ['relevance', 'top_rated', 'fastest', 'most_loved'];

    /**
     * Top real categories served by categories(), cached for an hour.
     */
    private const CATEGORY_LIMIT = 15;

    /**
     * Paginated, filterable list of recipes (per_page clamped to 1..100, default 15).
     */
    public function index(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $perPage = max(1, min(100, $request->integer('per_page', 15)));
        $page = max(1, $request->integer('page', 1));

        $isUnfilteredDefaultPage1 = ! $request->filled('search')
            && ! $request->filled('max_time')
            && $page === 1;

        if ($isUnfilteredDefaultPage1) {
            $cacheKey = CommunityFeedCache::timingCacheKey("recipes:index:p1:pp{$perPage}");

            $payload = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($perPage, $request) {
                $recipes = Recipe::query()
                    ->qualityTier()
                    ->select(RecipeCardResource::COLUMNS)
                    ->orderBy('id')
                    ->paginate($perPage);

                return RecipeCardResource::collection($recipes)->toResponse($request)->getData(true);
            });

            return response()->json($payload);
        }

        // Quality tier: the default Browse feed leads with the good stuff
        // (image + rating >= 4 + review_count >= 5, see Recipe::scopeQualityTier).
        $query = Recipe::query()->qualityTier();

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->string('search').'%');
        }

        if ($request->filled('max_time')) {
            $query->where('publisher_time_minutes', '<=', $request->integer('max_time'));
        }

        return RecipeCardResource::collection(
            $query
                // Card columns only (RecipeCardResource::COLUMNS): list rows
                // skip the multi-KB steps/ingredients_structured/keywords/
                // description payloads the detail/seed resource ships.
                ->select(RecipeCardResource::COLUMNS)
                // scopeQualityTier() already guarantees a non-empty image_url,
                // so ordering by id unlocks the partial quality-tier index.
                ->orderBy('id')
                ->paginate($perPage)
        );
    }

    /**
     * Full-text search over recipes: Typesense first when enabled
     * (TYPESENSE_API_KEY set — see TypesenseSearch::searchRecipes), with the
     * SQLite FTS5 index as an automatic fallback whenever the daemon is
     * disabled/unreachable/too slow (see migration 000017 +
     * recipereal:rebuild-search).
     *
     * Query params: q (optional), category (exact case-insensitive match on
     * recipes.category), max_time (applies to COALESCE(reality_minutes,
     * community_avg_minutes, publisher_time_minutes)), sort
     * (relevance|top_rated|fastest|most_loved, default relevance when q is
     * given else top_rated), page/per_page (per_page clamped to 1..50,
     * default 20). The response shape is identical on both engines:
     * RecipeCardResource rows in a standard paginator meta envelope.
     */
    public function search(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $perPage = max(1, min(50, $request->integer('per_page', 20)));
        $q = trim((string) $request->string('q'));
        $category = trim((string) $request->string('category'));
        $hasMaxTime = $request->filled('max_time');
        $sort = (string) $request->string('sort');
        $page = max(1, $request->integer('page', 1));

        $typesense = app(TypesenseSearch::class);
        $isUnfilteredDefaultPage1 = $q === ''
            && $category === ''
            && ! $hasMaxTime
            && ($sort === '' || $sort === 'top_rated')
            && $page === 1;

        if ($isUnfilteredDefaultPage1) {
            $tsFlag = $typesense->enabled() ? 1 : 0;
            $sortKey = $sort === '' ? 'default' : $sort;
            $cacheKey = CommunityFeedCache::timingCacheKey("recipes:search:p1:pp{$perPage}:s{$sortKey}:ts{$tsFlag}");

            $cached = Cache::get($cacheKey);
            if (is_array($cached) && isset($cached['payload'], $cached['etag'])) {
                $response = response()->json($cached['payload']);
                $response->setEtag($cached['etag']);
                $response->setCache([
                    'public' => true,
                    'max_age' => 60,
                    'stale_while_revalidate' => 300,
                ]);
                $response->isNotModified($request);

                return $response;
            }

            [$collection, $usedTypesense] = $this->resolveSearchCollection(
                $request,
                $typesense,
                $perPage,
                $q,
                $category,
                $hasMaxTime,
                $sort,
                $page
            );
            $payload = $collection->toResponse($request)->getData(true);
            $etag = sha1($cacheKey.'|'.$request->fullUrl().'|'.(json_encode($payload) ?: ''));
            $entry = [
                'payload' => $payload,
                'etag' => $etag,
            ];

            // Never pin a transient FTS fallback response under the :ts1 key.
            if (! $typesense->enabled() || $usedTypesense) {
                Cache::put($cacheKey, $entry, now()->addMinutes(5));
            }

            $response = response()->json($payload);
            $response->setEtag($etag);
            $response->setCache([
                'public' => true,
                'max_age' => 60,
                'stale_while_revalidate' => 300,
            ]);
            $response->isNotModified($request);

            return $response;
        }

        [$collection] = $this->resolveSearchCollection($request, $typesense, $perPage, $q, $category, $hasMaxTime, $sort, $page);

        return $collection;
    }

    /**
     * @return array{0: AnonymousResourceCollection, 1: bool} [collection, usedTypesense]
     */
    private function resolveSearchCollection(
        Request $request,
        TypesenseSearch $typesense,
        int $perPage,
        string $q,
        string $category,
        bool $hasMaxTime,
        string $sort,
        int $page,
    ): array {
        // Preferred engine: Typesense when enabled AND reachable. Any error,
        // timeout or disabled state degrades to the FTS5 path below — search
        // must never 500 because of the daemon.
        try {
            $typesenseResult = $typesense->searchRecipes(
                q: $q !== '' ? $q : '*',
                category: $category,
                timeMax: $hasMaxTime ? $request->integer('max_time') : null,
                sort: $sort,
                page: $page,
                perPage: $perPage
            );

            if ($typesenseResult !== null) {
                // Card shape (the hit-id hydration itself lives in
                // TypesenseSearch::searchRecipes, owned by another batch).
                return [RecipeCardResource::collection($typesenseResult), true];
            }
        } catch (Throwable $e) {
            Log::warning('typesense.search.fallback', ['error' => $e->getMessage()]);
        }

        return [$this->ftsSearch($request, $perPage, $q), false];
    }

    /**
     * The pre-Typesense FTS5 search, unchanged — now also the fallback path
     * when Typesense is disabled, unreachable or too slow. Same query
     * params as search(); $q and $perPage arrive pre-clamped.
     *
     * Falls back to a plain title LIKE when the FTS index is empty, missing
     * or errors (e.g. unmatched MATCH syntax on a different sqlite build).
     */
    private function ftsSearch(Request $request, int $perPage, string $q): AnonymousResourceCollection
    {
        $match = $this->ftsMatch($q);

        $sort = (string) $request->string('sort');
        if (! in_array($sort, self::SEARCH_SORTS, true)) {
            $sort = $match !== '' ? 'relevance' : 'top_rated';
        }

        if ($match !== '') {
            try {
                $query = Recipe::query()
                    ->listable()
                    ->join('recipes_fts', 'recipes_fts.rowid', '=', 'recipes.id')
                    // Card columns only, table-qualified for the join
                    // (recipes_fts carries none of them).
                    ->select($this->qualifiedCardColumns())
                    ->whereRaw('recipes_fts MATCH ?', [$match]);

                $this->applySearchFilters($query, $request);
                $this->applySearchOrder($query, $sort, withFts: true);

                $results = $query->paginate($perPage);

                if ($results->total() > 0) {
                    return RecipeCardResource::collection($results);
                }

                // Zero FTS hits: fall through to LIKE, which can still match
                // terms the tokenizer would not (e.g. inside JSON punctuation).
            } catch (QueryException) {
                // recipes_fts missing/erroring — LIKE fallback below.
            }
        }

        // LIKE fallback (or no q): listable applies here too.
        $query = Recipe::query()
            ->listable()
            ->select(RecipeCardResource::COLUMNS);

        if ($q !== '') {
            $query->where(function (Builder $like) use ($q): void {
                $like->where('title', 'like', "%{$q}%")
                    ->orWhere('title_ar', 'like', "%{$q}%")
                    ->orWhere('ingredients_ar', 'like', "%{$q}%");
            });
        }

        $this->applySearchFilters($query, $request);
        $this->applySearchOrder($query, $sort, withFts: false);

        return RecipeCardResource::collection($query->paginate($perPage));
    }

    /**
     * Top real recipe categories (by recipe count), cached for an hour.
     */
    public function categories(Request $request): JsonResponse
    {
        // Plain arrays only: this app's cache forbids unserializing classes
        // (cache.serializable_classes = false).
        $categories = Cache::remember('recipes:categories', now()->addHour(), function () {
            return DB::table('recipes')
                ->select('category', DB::raw('COUNT(*) AS count'))
                ->whereNotNull('category')
                ->where('category', '!=', '')
                ->groupBy('category')
                ->orderByDesc('count')
                ->limit(self::CATEGORY_LIMIT)
                ->get()
                ->map(fn ($row) => ['category' => $row->category, 'count' => (int) $row->count])
                ->all();
        });

        $response = response()->json(['data' => $categories]);
        $response->setEtag(sha1(json_encode($categories) ?: ''));
        $response->setCache([
            'public' => true,
            'max_age' => 300,
            'stale_while_revalidate' => 600,
        ]);
        $response->isNotModified($request);

        return $response;
    }

    /**
     * Sanitize free text into an FTS5 MATCH expression via RecipeFtsIndex
     * so query normalization matches index-time normalization.
     */
    private function ftsMatch(string $q): string
    {
        return RecipeFtsIndex::matchExpression($q);
    }

    /**
     * Shared category / max_time filters for the FTS and fallback queries.
     */
    private function applySearchFilters(Builder $query, Request $request): void
    {
        if ($request->filled('category')) {
            // Trimmed exact value; SQLite LIKE is case-insensitive for ASCII.
            $query->where('recipes.category', 'like', trim((string) $request->string('category')));
        }

        if ($request->filled('max_time')) {
            $query->whereRaw(
                'COALESCE(recipes.community_avg_minutes, recipes.publisher_time_minutes) <= ?',
                [$request->integer('max_time')]
            );
        }
    }

    /**
     * Sort orders. `IS NULL ASC` puts nulls last on SQLite (0 sorts before 1).
     *
     * Every sort is tier-boosted: quality-tier rows (image + rating >= 4 +
     * review_count >= 5) sort before everything else regardless of the
     * requested order — search still covers the WHOLE library, it just
     * surfaces the good stuff first. Columns are table-qualified for the
     * recipes_fts join (which has no such columns).
     */
    private function applySearchOrder(Builder $query, string $sort, bool $withFts): void
    {
        $query->orderByRaw(
            '(recipes.image_url IS NOT NULL AND recipes.aggregated_rating >= 4 AND recipes.review_count >= 5) DESC'
        );

        match ($sort) {
            'relevance' => $withFts
                // FTS5 bm25() is negative-better, so ascending = best match
                // first; rating breaks ties.
                ? $query->orderByRaw('bm25(recipes_fts) ASC')
                    ->orderByRaw('recipes.aggregated_rating IS NULL ASC, recipes.aggregated_rating DESC')
                : $query->orderByRaw('recipes.aggregated_rating IS NULL ASC, recipes.aggregated_rating DESC, recipes.review_count DESC'),
            'fastest' => $query
                ->orderByRaw('COALESCE(recipes.community_avg_minutes, recipes.publisher_time_minutes) IS NULL ASC')
                ->orderByRaw('COALESCE(recipes.community_avg_minutes, recipes.publisher_time_minutes) ASC'),
            'most_loved' => $query->orderByDesc('recipes.review_count'),
            default => $query
                ->orderByRaw('recipes.aggregated_rating IS NULL ASC, recipes.aggregated_rating DESC')
                ->orderByDesc('recipes.review_count'),
        };
    }

    /**
     * RecipeCardResource::COLUMNS qualified with the recipes table, for
     * queries joined against recipes_fts (which shares only rowid).
     *
     * @return list<string>
     */
    private function qualifiedCardColumns(): array
    {
        return array_map(
            static fn (string $column): string => 'recipes.'.$column,
            RecipeCardResource::COLUMNS
        );
    }

    /**
     * Bulk offline-download endpoint: recipes with their steps.
     *
     * Mobile uses paged mode (?page=N&per_page=M, per_page clamped to
     * 1..100, default 50) for progressive first-load; without a page param
     * a capped 1000-recipe dump is returned for backward compatibility (the
     * full 520k-row unpaged dump is a footgun — use paged mode for bulk).
     */
    public function seed(Request $request): AnonymousResourceCollection|JsonResponse
    {
        if ($request->filled('page')) {
            $perPage = max(1, min(100, $request->integer('per_page', 50)));
            $page = max(1, $request->integer('page', 1));
            $cacheKey = CommunityFeedCache::timingCacheKey("recipes:seed:v2:p{$page}:pp{$perPage}");

            // Paged mode: the ENTIRE library (photos ordered first) — the
            // offline cache mirrors what Browse/search serve online. This
            // used to filter to the quality tier (image + rating + steps +
            // reviews ≈ 2.5k of 20k), which capped every device's "full"
            // sync at the curated subset; the tier remains a SORT input
            // (photos first), not an inclusion rule.
            $cached = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($cacheKey, $perPage, $request) {
                $recipes = Recipe::select(RecipeResource::COLUMNS)
                    ->with('recipeSteps:'.RecipeResource::STEP_COLUMNS)
                    ->orderByRaw('image_url IS NOT NULL DESC, id ASC')
                    ->paginate($perPage);

                $payload = RecipeResource::collection($recipes)->toResponse($request)->getData(true);

                return [
                    'payload' => $payload,
                    'etag' => sha1($cacheKey.'|'.$request->fullUrl().'|'.(json_encode($payload) ?: '')),
                ];
            });

            $response = response()->json($cached['payload']);
            $response->setEtag($cached['etag']);
            $response->setCache([
                'public' => true,
                'max_age' => 60,
                'stale_while_revalidate' => 300,
            ]);
            $response->isNotModified($request);

            return $response;
        }

        $recipes = Recipe::select(RecipeResource::COLUMNS)
            ->with('recipeSteps:'.RecipeResource::STEP_COLUMNS)
            ->orderByRaw('image_url IS NOT NULL DESC, id ASC')
            ->limit(1000)
            ->get();

        return RecipeResource::collection($recipes);
    }

    /**
     * Single recipe detail including its steps.
     *
     * Free-tier gating is held while the premium plan is paused: every
     * signed-in user can read any recipe (no 5/month limit). Views are still
     * recorded in the monthly ledger so usage stats stay accurate if the
     * limit is ever re-enabled.
     */
    public function show(Request $request, Recipe $recipe): JsonResponse
    {
        // Recipes are public for browsing, so resolve the user from the
        // sanctum guard explicitly (no auth:sanctum middleware on this route).
        $user = $request->user('sanctum');

        if ($user) {
            // firstOrCreate so repeat views of the same recipe this month
            // don't double-count (informational only — no limit enforced).
            // Queued off the read path: the detail response no longer awaits
            // the RecipeView SELECT+INSERT (runs inline on sync connections).
            RecordRecipeView::dispatch($user->id, $recipe->id, now()->format('Y-m'));
        }

        // RecipeResource does not vary by user, so the resolved detail payload
        // can be cached across readers keyed by recipe id, timingVersion, and
        // updated_at while still recording views for authed callers above.
        $updatedAt = $recipe->updated_at?->format('U.u') ?? '0';
        $cacheKey = CommunityFeedCache::timingCacheKey("recipes:show:{$recipe->id}:u{$updatedAt}");

        $payload = Cache::remember($cacheKey, now()->addMinutes(15), function () use ($recipe, $request) {
            $recipe->load('recipeSteps:'.RecipeResource::STEP_COLUMNS);

            return (new RecipeResource($recipe))->toResponse($request)->getData(true);
        });

        return response()->json($payload);
    }
}
