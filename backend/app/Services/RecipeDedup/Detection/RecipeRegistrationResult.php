<?php

namespace App\Services\RecipeDedup\Detection;

use App\Models\Recipe;
use App\Services\RecipeDedup\Data\DuplicateDecision;

/**
 * What RecipeRegistrar::register() produced: the duplicate decision AND
 * the freshly persisted Recipe — present when (and only when) the
 * decision was ACTION_ACCEPTED and the insert (recipe + steps +
 * fingerprint) committed.
 */
final class RecipeRegistrationResult
{
    public function __construct(
        public readonly DuplicateDecision $decision,
        public readonly ?Recipe $recipe = null,
    ) {}

    /**
     * True only when a recipe row was actually created AND committed.
     */
    public function accepted(): bool
    {
        return $this->decision->accepted() && $this->recipe !== null;
    }
}
