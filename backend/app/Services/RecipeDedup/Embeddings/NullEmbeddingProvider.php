<?php

namespace App\Services\RecipeDedup\Embeddings;

use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;

/**
 * The disabled provider (DEDUP_EMBEDDINGS_ENABLED=false or protocol 'none').
 * It exists so the container always resolves a usable EmbeddingProvider;
 * embed() throws EmbeddingException because embedding is genuinely off —
 * callers guard with the enabled-style config checks first
 * (EmbeddingService does). key() = 'none' is the signal other slices check.
 */
final class NullEmbeddingProvider implements EmbeddingProvider
{
    public function key(): string
    {
        return 'none';
    }

    public function model(): string
    {
        return 'none';
    }

    public function embed(array $texts): EmbeddingResult
    {
        throw new EmbeddingException('Embeddings are disabled');
    }
}
