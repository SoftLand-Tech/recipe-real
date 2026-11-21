<?php

namespace App\Services\RecipeDedup\Detection;

use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;

/**
 * Result of one CandidateRetriever::retrieve() round: the deduped,
 * meta-enriched candidate list JOINED with its identities (index-aligned
 * with $candidates), the candidate's own embedding vector (null when the
 * semantic layer was skipped or failed — missing features are EXCLUDED
 * from the weighted score, never scored 0) and per-source hit counts for
 * observability (pre-cap, per-source).
 *
 * $candidates[i] and $identities[i] always describe the same recipe.
 *
 * @param  list<CandidateRecipe>  $candidates
 * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $identities
 * @param  list<float>|null  $vector
 * @param  array<string, int>  $sources  retrieval_source => raw hit count
 */
final class CandidateRetrieval
{
    public function __construct(
        public readonly array $candidates = [],
        public readonly array $identities = [],
        public readonly ?array $vector = null,
        public readonly array $sources = [],
    ) {}

    /** @return list<array{id:int, title:string, identity:CulinaryIdentity}> */
    public function judgeEntries(): array
    {
        return $this->identities;
    }

    public function isEmpty(): bool
    {
        return $this->candidates === [];
    }
}
