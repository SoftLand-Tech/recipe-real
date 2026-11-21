<?php

namespace App\Services\RecipeDedup\Data;

/**
 * Result of one embedding batch against the provider.
 */
final class EmbeddingResult
{
    /**
     * @param  list<list<float>>  $vectors  aligned with the requested texts
     */
    public function __construct(
        public readonly array $vectors,
        public readonly string $model,
        public readonly int $dimensions,
    ) {}
}
