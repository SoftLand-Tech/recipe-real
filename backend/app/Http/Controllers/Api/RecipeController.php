<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeResource;
use App\Models\Recipe;
use App\Models\RecipeView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RecipeController extends Controller
{
    /**
     * Free-tier monthly distinct-recipe limit.
     */
    public const FREE_MONTHLY_LIMIT = 5;
    /**
     * Paginated, filterable list of recipes (15/page).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Recipe::query();

        if ($request->filled('search')) {
            $query->where('title', 'like', '%'.$request->string('search').'%');
        }

        if ($request->filled('max_time')) {
            $query->where('publisher_time_minutes', '<=', $request->integer('max_time'));
        }

        return RecipeResource::collection(
            $query->orderBy('id')->paginate(15)
        );
    }

    /**
     * Bulk offline-download endpoint: all recipes with their steps, no pagination.
     */
    public function seed(): AnonymousResourceCollection
    {
        $recipes = Recipe::with('recipeSteps')->orderBy('id')->get();

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
