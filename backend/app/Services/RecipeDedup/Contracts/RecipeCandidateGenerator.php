<?php

namespace App\Services\RecipeDedup\Contracts;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\GenerationException;
use App\Services\RecipeDedup\Data\GenerationRequest;

/**
 * Recipe generator adapter for batch generation (recipereal:generate-batch).
 * Implementations return COMPLETE recipe drafts; the dedup engine owns
 * acceptance. Never depends on the generator remembering earlier output.
 */
interface RecipeCandidateGenerator
{
    /**
     * @return list<CandidateRecipe> 0.. $request->count drafts
     *
     * @throws GenerationException on transport/HTTP/parsing failures
     */
    public function generate(GenerationRequest $request): array;
}
