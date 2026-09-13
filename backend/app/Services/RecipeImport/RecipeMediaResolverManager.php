<?php

namespace App\Services\RecipeImport;

use App\Services\RecipeImport\Contracts\RecipeMediaResolver;

class RecipeMediaResolverManager
{
    public function resolver(): RecipeMediaResolver
    {
        return app(ExternalMediaResolver::class);
    }
}
