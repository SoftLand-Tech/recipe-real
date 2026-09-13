<?php

namespace App\Services\RecipeImport\Contracts;

use App\Models\RecipeImport;

interface RecipeAiProvider
{
    public function key(): string;

    public function model(): ?string;

    /**
     * Extract recipe content from the resolved source and return provider
     * JSON. The normalizer owns the public draft contract.
     *
     * @param  array<string, mixed>  $source
     * @return array<string, mixed>
     */
    public function extract(RecipeImport $import, array $source): array;
}
