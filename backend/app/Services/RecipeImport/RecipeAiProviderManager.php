<?php

namespace App\Services\RecipeImport;

use App\Services\RecipeImport\Contracts\RecipeAiProvider;

class RecipeAiProviderManager
{
    public function provider(?string $name = null): RecipeAiProvider
    {
        // client provider selection disabled by default, admin-only feature
        $requested = $name !== null && (bool) config('recipereal.ai.allow_client_provider', false)
            ? $name
            : null;
        $key = trim((string) ($requested ?: config('recipereal.ai.default', 'custom')));
        if (! preg_match('/^[a-z0-9_-]+$/i', $key)) {
            throw new RecipeImportException(
                'The selected recipe AI provider is not configured.',
                'provider_not_configured',
            );
        }

        $config = config('recipereal.ai.providers.'.$key);

        if (! is_array($config)) {
            throw new RecipeImportException(
                'The selected recipe AI provider is not configured.',
                'provider_not_configured',
            );
        }

        return match (strtolower((string) ($config['driver'] ?? 'http'))) {
            'agy', 'cli' => new AgyRecipeAiProvider($key, $config, app(RecipeImportStorage::class)),
            default => new HttpRecipeAiProvider($key, $config, app(RecipeImportStorage::class)),
        };
    }
}
