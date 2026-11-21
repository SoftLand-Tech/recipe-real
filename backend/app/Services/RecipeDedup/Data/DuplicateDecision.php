<?php

namespace App\Services\RecipeDedup\Data;

/**
 * The final verdict of the dedup engine for one candidate.
 *
 * action is one of:
 *   - 'accepted'      genuinely new; safe to persist.
 *   - 'duplicate'     rejected — matched an existing recipe / batch recipe.
 *   - 'needs_review'  uncertain (AI flagged uncertain or the judge failed):
 *                     the candidate may be persisted-with-flag or skipped
 *                     by the caller, and a review record is created.
 */
final class DuplicateDecision
{
    public const ACTION_ACCEPTED = 'accepted';

    public const ACTION_DUPLICATE = 'duplicate';

    public const ACTION_NEEDS_REVIEW = 'needs_review';

    public function __construct(
        public readonly string $action,
        public readonly int $layer,
        public readonly ?int $matchedRecipeId = null,
        public readonly ?DuplicateScore $score = null,
        public readonly ?string $classification = null,
        public readonly ?float $confidence = null,
        public readonly ?string $reason = null,
        public readonly array $differences = [],
        public readonly bool $isDuplicate = false,
        public ?int $checkId = null,
    ) {}

    public function accepted(): bool
    {
        return $this->action === self::ACTION_ACCEPTED;
    }

    public function withCheckId(int $checkId): self
    {
        $clone = clone $this;
        $clone->checkId = $checkId;

        return $clone;
    }
}
