<?php

namespace App\Services\RecipeDedup\Contracts;

use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * The Layer 3 AI duplicate verifier. It receives ONLY the candidate's
 * structured culinary identity plus the candidate list's identities —
 * never the database, never raw recipes.
 */
interface AiDuplicateJudge
{
    /**
     * @param  CandidateRecipe  $candidate
     * @param  CulinaryIdentity  $candidateIdentity
     * @param  list<array{id:int, title: string, identity: CulinaryIdentity}>  $existing
     * @return AiJudgeResponse
     *
     * @throws AiJudgeException on transport errors, HTTP errors, timeouts,
     *                          or an unparseable/invalid structured response
     */
    public function judge(
        CandidateRecipe $candidate,
        CulinaryIdentity $candidateIdentity,
        array $existing,
    ): AiJudgeResponse;
}
