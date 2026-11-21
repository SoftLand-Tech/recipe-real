<?php

namespace App\Services\RecipeDedup\Data;

/**
 * Request for RecipeCandidateGenerator: what to generate next.
 */
final class GenerationRequest
{
    /**
     * @param  string  $brief  freeform brief ("Italian pasta mains")
     * @param  int  $count  recipes requested THIS call
     * @param  string|null  $cuisine
     * @param  string|null  $dishFamily
     * @param  string|null  $category
     * @param  list<string>  $avoidTitles  titles already accepted/attempted in this batch
     * @param  string  $language  output language for new recipes ("en", "ar")
     * @param  int  $iteration  zero-based loop iteration (helps the prompt diversify)
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public readonly string $brief,
        public readonly int $count,
        public readonly ?string $cuisine = null,
        public readonly ?string $dishFamily = null,
        public readonly ?string $category = null,
        public readonly array $avoidTitles = [],
        public readonly string $language = 'en',
        public readonly int $iteration = 0,
        public readonly array $meta = [],
    ) {}
}
