<?php

namespace App\Services\RecipeDedup\Vector;

use App\Services\RecipeDedup\Contracts\VectorStore;

/**
 * The disabled vector store (DEDUP_VECTOR_DRIVER=none). Invariant: callers
 * should check enabled() first (EmbeddingService does), but even a MISSED
 * check must not explode — every method is a safe no-op, nothing is stored
 * and search always comes back empty.
 */
final class NullVectorStore implements VectorStore
{
    public function enabled(): bool
    {
        return false;
    }

    public function collection(): string
    {
        return 'none';
    }

    public function ensureCollection(int $dimensions): void {}

    public function upsertMany(array $points): void {}

    public function search(array $vector, int $limit, array $filters = []): array
    {
        return [];
    }

    public function delete(int $recipeId): void {}

    public function ping(): bool
    {
        return false;
    }
}
