<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeResource;
use App\Models\Recipe;
use App\Models\RecipeView;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class RecipeController extends Controller
{
    /**
     * Free-tier monthly distinct-recipe limit.
     */
    public const FREE_MONTHLY_LIMIT = 5;

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
    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = max(1, min(100, $request->integer('per_page', 15)));

        // Listable: hide recipes with fewer than 2 steps (degenerate imports).
        $query = Recipe::query()->listable();

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->string('search').'%');
        }

        if ($request->filled('max_time')) {
            $query->where('publisher_time_minutes', '<=', $request->integer('max_time'));
        }

        return RecipeResource::collection(
            $query
                // Recipes with an image first, then stable id order within
                // each group (imported rows without photos sink to the end).
                ->orderByRaw('image_url IS NOT NULL DESC, id ASC')
                ->paginate($perPage)
        );
    }

    /**
     * Full-text search over recipes (FTS5, see migration 000017 + the
     * recipereal:rebuild-search command).
     *
     * Query params: q (optional), category (exact case-insensitive match on
     * recipes.category), max_time (applies to COALESCE(community_avg_minutes,
     * publisher_time_minutes)), sort (relevance|top_rated|fastest|most_loved,
     * default relevance when q is given else top_rated), page/per_page
     * (per_page clamped to 1..50, default 20).
     *
     * Falls back to a plain title LIKE when the FTS index is empty, missing
     * or errors (e.g. unmatched MATCH syntax on a different sqlite build).
     */
    public function search(Request $request): AnonymousResourceCollection
    {
        $perPage = max(1, min(50, $request->integer('per_page', 20)));
        $q = trim((string) $request->string('q'));
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
                    ->select('recipes.*')
                    ->whereRaw('recipes_fts MATCH ?', [$match]);

                $this->applySearchFilters($query, $request);
                $this->applySearchOrder($query, $sort, withFts: true);

                $results = $query->paginate($perPage);

                if ($results->total() > 0) {
                    return RecipeResource::collection($results);
                }

                // Zero FTS hits: fall through to LIKE, which can still match
                // terms the tokenizer would not (e.g. inside JSON punctuation).
            } catch (QueryException) {
                // recipes_fts missing/erroring — LIKE fallback below.
            }
        }

        // LIKE fallback (or no q): listable applies here too.
        $query = Recipe::query()->listable();

        if ($q !== '') {
            $query->where('title', 'like', "%{$q}%");
        }

        $this->applySearchFilters($query, $request);
        $this->applySearchOrder($query, $sort, withFts: false);

        return RecipeResource::collection($query->paginate($perPage));
    }

    /**
     * Top real recipe categories (by recipe count), cached for an hour.
     */
    public function categories(): JsonResponse
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

        return response()->json(['data' => $categories]);
    }

    /**
     * Sanitize free text into an FTS5 MATCH expression: each token stripped
     * to letters/digits (quotes, colons, hyphens etc. are FTS5 syntax and
     * break the parser), suffixed with `*` for prefix matching, joined by
     * spaces (implicit AND). Returns '' when nothing usable remains.
     */
    private function ftsMatch(string $q): string
    {
        $tokens = preg_split('/\s+/u', $q) ?: [];

        $tokens = array_map(
            fn (string $token) => (string) preg_replace('/[^\p{L}\p{N}]/u', '', $token),
            $tokens
        );

        $tokens = array_values(array_filter(
            $tokens,
            fn (string $token) => $token !== ''
        ));

        return implode(' ', array_map(
            fn (string $token) => $token.'*',
            $tokens
        ));
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
     */
    private function applySearchOrder(Builder $query, string $sort, bool $withFts): void
    {
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
     * Bulk offline-download endpoint: recipes with their steps.
     *
     * Mobile uses paged mode (?page=N&per_page=M, per_page clamped to
     * 1..100, default 50) for progressive first-load; without a page param
     * a capped 1000-recipe dump is returned for backward compatibility (the
     * full 520k-row unpaged dump is a footgun — use paged mode for bulk).
     */
    public function seed(Request $request): AnonymousResourceCollection
    {
        if ($request->filled('page')) {
            $perPage = max(1, min(100, $request->integer('per_page', 50)));

            // Paged mode: listable (>= 2 steps) so offline clients don't
            // sync degenerate imports. The legacy unpaged dump below keeps
            // its original behavior.
            $recipes = Recipe::with('recipeSteps')
                ->listable()
                ->orderByRaw('image_url IS NOT NULL DESC, id ASC')
                ->paginate($perPage);
        } else {
            $recipes = Recipe::with('recipeSteps')
                ->orderByRaw('image_url IS NOT NULL DESC, id ASC')
                ->limit(1000)
                ->get();
        }

        return RecipeResource::collection($recipes);
    }

    /**
     * Single recipe detail including its steps.
     *
     * Enforces the free-tier usage limit (5 distinct recipes/month). Premium
     * users skip the limit entirely.
     */
    public function show(Request $request, Recipe $recipe): RecipeResource|JsonResponse
    {
        $recipe->load('recipeSteps');

        // Recipes are public for browsing, so resolve the user from the
        // sanctum guard explicitly (no auth:sanctum middleware on this route).
        $user = $request->user('sanctum');

        if ($user && ! $user->isPremium()) {
            $monthKey = now()->format('Y-m');

            $alreadyViewed = RecipeView::where('user_id', $user->id)
                ->where('recipe_id', $recipe->id)
                ->where('month_key', $monthKey)
                ->exists();

            if (! $alreadyViewed) {
                $viewedCount = RecipeView::where('user_id', $user->id)
                    ->where('month_key', $monthKey)
                    ->count();

                if ($viewedCount >= self::FREE_MONTHLY_LIMIT) {
                    return response()->json([
                        'message' => 'Free tier limit reached (5 recipes/month). Upgrade for unlimited.',
                        'limit' => self::FREE_MONTHLY_LIMIT,
                        'upgrade' => true,
                    ], 402);
                }
            }

            // firstOrCreate so repeat views of the same recipe this month
            // don't double-count against the limit.
            RecipeView::firstOrCreate([
                'user_id' => $user->id,
                'recipe_id' => $recipe->id,
                'month_key' => $monthKey,
            ]);
        }

        return new RecipeResource($recipe);
    }
}
