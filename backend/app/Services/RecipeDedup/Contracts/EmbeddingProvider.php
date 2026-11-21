<?php

namespace App\Services\RecipeDedup\Contracts;

use App\Services\RecipeDedup\Data\EmbeddingResult;
use App\Services\RecipeDedup\EmbeddingException;

interface EmbeddingProvider
{
    public function key(): string;

    public function model(): string;

    /**
     * Embed a batch of texts. The returned vectors MUST align index-for-index
     * with the given texts.
     *
     * @param  list<string>  $texts
     * @return EmbeddingResult
     *
     * @throws EmbeddingException on transport errors, HTTP errors, or a
     *                            response whose vector count/shape mismatches
     */
    public function embed(array $texts): EmbeddingResult;
}
