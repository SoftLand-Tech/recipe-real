<?php

namespace App\Services\RecipeImport\Data;

/**
 * Normalized, provider-independent recipe draft.
 *
 * This is intentionally an array-backed DTO: it is persisted as JSON for a
 * short-lived review record and returned unchanged to mobile/admin clients.
 */
final class RecipeExtraction
{
    /**
     * @param  array<string, mixed>  $draft
     * @param  list<string>  $warnings
     * @param  array<string, mixed>  $confidence
     */
    public function __construct(
        public readonly array $draft,
        public readonly array $warnings,
        public readonly array $confidence,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return $this->draft;
    }
}
