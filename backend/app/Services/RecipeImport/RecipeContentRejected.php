<?php

namespace App\Services\RecipeImport;

use RuntimeException;

class RecipeContentRejected extends RuntimeException
{
    /** @param list<string> $terms */
    public function __construct(public readonly array $terms)
    {
        parent::__construct('This recipe contains disallowed ingredients or alcohol references.');
    }
}
