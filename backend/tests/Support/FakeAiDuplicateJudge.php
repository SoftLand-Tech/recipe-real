<?php

namespace Tests\Support;

use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * Deterministic AI judge fake. Default rule: duplicate when the candidate's
 * canonical dish equals one of the offered identities; otherwise distinct.
 * Tests control behavior via $handler (last-write-wins script).
 */
final class FakeAiDuplicateJudge implements AiDuplicateJudge
{
    public int $calls = 0;

    /** @var null|\Closure(list<array{id:int,title:string,identity:CulinaryIdentity}>, CandidateRecipe): AiJudgeResponse */
    public $handler = null;

    public ?AiJudgeException $throws = null;

    public function judge(CandidateRecipe $candidate, CulinaryIdentity $candidateIdentity, array $existing): AiJudgeResponse
    {
        $this->calls++;

        if ($this->throws instanceof AiJudgeException) {
            throw $this->throws;
        }

        if ($this->handler instanceof \Closure) {
            return ($this->handler)($existing, $candidate);
        }

        foreach ($existing as $entry) {
            if ($entry['identity']->canonicalDish !== ''
                && $entry['identity']->canonicalDish === $candidateIdentity->canonicalDish) {
                return new AiJudgeResponse(
                    classification: AiJudgeResponse::CLASSIFICATION_DUPLICATE,
                    isDuplicate: true,
                    matchedRecipeId: $entry['id'],
                    confidence: 0.97,
                    reason: 'Same canonical dish: '.$candidateIdentity->canonicalDish,
                    differences: [],
                );
            }
        }

        return new AiJudgeResponse(
            classification: AiJudgeResponse::CLASSIFICATION_DISTINCT,
            isDuplicate: false,
            matchedRecipeId: null,
            confidence: 0.93,
            reason: 'Distinct culinary identity',
            differences: [],
        );
    }
}
