<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\RecipeResource;
use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RecipeController extends Controller
{
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
     */
    public function show(Recipe $recipe): RecipeResource
    {
        $recipe->load('recipeSteps');

        return new RecipeResource($recipe);
    }
}
