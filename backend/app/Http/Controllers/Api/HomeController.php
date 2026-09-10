<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeCardResource;
use App\Models\Recipe;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Support\CommunityFeedCache;
use Illuminate\Support\Facades\Cache;

/**
 * Home-screen rails (public): four curated "best of" lists, each a slim
 * RecipeCardResource card list of 10 (no steps — the card never ships the
 * heavy detail payloads). Cached 30 minutes: every rail sorts over the
 * whole 520k-row table, but rows carry stable id tiebreakers so longer
 * staleness is fine for curated content (deploy-time cache:clear busts).
 */
class HomeController extends Controller
{
    private const RAIL_SIZE = 10;

    public function __invoke(Request $request): JsonResponse
    {
        // The cache holds plain attribute arrays (this app's cache forbids
        // unserializing classes — cache.serializable_classes = false), so
        // rails are hydrated back into models before resource conversion.
        // The key carries the global timing version: any timing write
        // (cook sessions, quick-time logs, backfills) bumps it, so rails
        // never replay pre-write averages/rankings.
        $rails = Cache::remember(
            CommunityFeedCache::timingCacheKey('home:rails'),
            now()->addMinutes(30),
            fn () => $this->buildRails()
        );

        return response()->json([
            'data' => [
                'top_rated' => RecipeCardResource::collection(Recipe::hydrate($rails['top_rated']))->resolve(),
                'easy_wins' => RecipeCardResource::collection(Recipe::hydrate($rails['easy_wins']))->resolve(),
                'most_loved' => RecipeCardResource::collection(Recipe::hydrate($rails['most_loved']))->resolve(),
                'hands_off' => RecipeCardResource::collection(Recipe::hydrate($rails['hands_off']))->resolve(),
            ],
        ]);
    }

    /**
     * @return array<string, list<array<string, mixed>>> raw recipe attributes per rail
     */
    private function buildRails(): array
    {
        // All four rails draw from the quality tier (Recipe::scopeQualityTier:
        // >= 2 steps, image, rating >= 4, review_count >= 5) — the same rule
        // as the Browse feed and the paged seed. Rail-specific extras
        // (review thresholds, time window, passive steps) stay on top.
        return [
            // Crowd favourites: well-rated by a meaningful number of reviewers.
            'top_rated' => Recipe::query()
                ->qualityTier()
                ->select(RecipeCardResource::COLUMNS)
                ->where('review_count', '>=', 10)
                ->orderByDesc('aggregated_rating')
                ->orderByDesc('review_count')
                ->orderBy('id')
                ->limit(self::RAIL_SIZE)
                ->get()
                ->map(fn (Recipe $recipe) => $recipe->getAttributes())
                ->all(),

            // Quick wins: at most ~30 minutes door-to-door using the best
            // known time (community consensus over publisher claim).
            'easy_wins' => Recipe::query()
                ->qualityTier()
                ->select(RecipeCardResource::COLUMNS)
                ->whereRaw('COALESCE(community_avg_minutes, publisher_time_minutes) BETWEEN 1 AND 30')
                ->orderByRaw('COALESCE(community_avg_minutes, publisher_time_minutes) IS NULL ASC')
                ->orderByRaw('COALESCE(community_avg_minutes, publisher_time_minutes) ASC')
                ->orderByRaw('aggregated_rating IS NULL ASC, aggregated_rating DESC')
                ->orderBy('id')
                ->limit(self::RAIL_SIZE)
                ->get()
                ->map(fn (Recipe $recipe) => $recipe->getAttributes())
                ->all(),

            // Most reviewed = most cooked.
            'most_loved' => Recipe::query()
                ->qualityTier()
                ->select(RecipeCardResource::COLUMNS)
                ->where('review_count', '>=', 25)
                ->orderByDesc('review_count')
                ->orderBy('id')
                ->limit(self::RAIL_SIZE)
                ->get()
                ->map(fn (Recipe $recipe) => $recipe->getAttributes())
                ->all(),

            // Hands-off cooking: two or more passive steps (marinate, bake,
            // chill...). Empty until the step classifier backfills
            // step_type — expected. The recipe_steps.recipe_id index keeps
            // the EXISTS subquery cheap.
            'hands_off' => Recipe::query()
                ->qualityTier()
                ->select(RecipeCardResource::COLUMNS)
                ->whereExists(function ($sub): void {
                    $sub->selectRaw('1')
                        ->from('recipe_steps')
                        ->whereColumn('recipe_steps.recipe_id', 'recipes.id')
                        ->where('recipe_steps.step_type', 'passive')
                        ->groupBy('recipe_steps.recipe_id')
                        ->havingRaw('COUNT(*) >= 2');
                })
                ->orderByRaw('aggregated_rating IS NULL ASC, aggregated_rating DESC')
                ->orderBy('id')
                ->limit(self::RAIL_SIZE)
                ->get()
                ->map(fn (Recipe $recipe) => $recipe->getAttributes())
                ->all(),
        ];
    }
}
