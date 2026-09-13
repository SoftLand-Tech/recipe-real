<?php

namespace App\Services\RecipeImport\Contracts;

use App\Models\RecipeImport;

interface RecipeMediaResolver
{
    /**
     * @return array<string, mixed>
     */
    public function resolve(RecipeImport $import): array;
}
