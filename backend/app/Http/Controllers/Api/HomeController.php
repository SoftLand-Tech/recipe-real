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
        // The cache holds already-resolved plain RecipeCardResource arrays
        // (cache.serializable_classes = false forbids object unserialization),
        // skipping Recipe::hydrate() and resource mapping on cache hits.
        // The key carries the global timing version: any timing write
        // (cook sessions, quick-time logs, backfills) bumps it, so rails
        // never replay pre-write averages/rankings.
        $cacheKey = CommunityFeedCache::timingCacheKey('home:rails');
        $etag = sha1($cacheKey.'|'.$request->fullUrl());

        $rails = Cache::remember(
            $cacheKey,
            now()->addMinutes(30),
            fn () => $this->buildRails()
        );

        $response = response()->json([
            'data' => $rails,
        ]);
        $response->setEtag($etag);
        $response->setCache([
            'public' => true,
            'max_age' => 60,
            'stale_while_revalidate' => 300,
        ]);
        $response->isNotModified($request);

        return $response;
    }

    /**
     * @return array<string, list<array<string, mixed>>> resolved RecipeCardResource arrays per rail
     */
    private function buildRails(): array
    {
        // All four rails draw from the quality tier (Recipe::scopeQualityTier:
        // >= 2 steps, image, rating >= 4, review_count >= 5) — the same rule
        // as the Browse feed and the paged seed. Rail-specific extras
        // (review thresholds, time window, passive steps) stay on top.
        return [
            // Crowd favourites: well-rated by a meaningful number of reviewers.
            'top_rated' => RecipeCardResource::collection(
                Recipe::query()
                    ->qualityTier()
                    ->select(RecipeCardResource::COLUMNS)
                    ->where('review_count', '>=', 10)
                    ->orderByDesc('aggregated_rating')
                    ->orderByDesc('review_count')
                    ->orderBy('id')
                    ->limit(self::RAIL_SIZE)
                    ->get()
            )->resolve(),

            // Quick wins: at most ~30 minutes door-to-door using the best
            // known time (community consensus over publisher claim).
            'easy_wins' => RecipeCardResource::collection(
                Recipe::query()
                    ->qualityTier()
                    ->select(RecipeCardResource::COLUMNS)
                    ->whereRaw('COALESCE(community_avg_minutes, publisher_time_minutes) BETWEEN 1 AND 30')
                    ->orderByRaw('COALESCE(community_avg_minutes, publisher_time_minutes) IS NULL ASC')
                    ->orderByRaw('COALESCE(community_avg_minutes, publisher_time_minutes) ASC')
                    ->orderByRaw('aggregated_rating IS NULL ASC, aggregated_rating DESC')
                    ->orderBy('id')
                    ->limit(self::RAIL_SIZE)
                    ->get()
            )->resolve(),

            // Most reviewed = most cooked.
            'most_loved' => RecipeCardResource::collection(
                Recipe::query()
                    ->qualityTier()
                    ->select(RecipeCardResource::COLUMNS)
                    ->where('review_count', '>=', 25)
                    ->orderByDesc('review_count')
                    ->orderBy('id')
                    ->limit(self::RAIL_SIZE)
                    ->get()
            )->resolve(),

            // Hands-off cooking: two or more passive steps (marinate, bake,
            // chill...). Empty until the step classifier backfills
            // step_type — expected. The recipe_steps.recipe_id index keeps
            // the EXISTS subquery cheap.
            'hands_off' => RecipeCardResource::collection(
                Recipe::query()
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
            )->resolve(),
        ];
    }
}
