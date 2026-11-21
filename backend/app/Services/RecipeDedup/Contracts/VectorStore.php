<?php

namespace App\Services\RecipeDedup\Contracts;

use App\Services\RecipeDedup\VectorStoreException;

/**
 * Vector database abstraction. Implementations: Qdrant (production), Null
 * (feature off), plus test fakes. One point per recipe: point id is the
 * recipe id, so upsert/delete are idempotent.
 */
interface VectorStore
{
    public function enabled(): bool;

    public function collection(): string;

    /**
     * Create the collection when missing (no-op when it exists).
     *
     * @throws VectorStoreException
     */
    public function ensureCollection(int $dimensions): void;

    /**
     * @param  array<int, array{id:int, vector:list<float>, payload:array<string,mixed>}>  $points
     *
     * @throws VectorStoreException
     */
    public function upsertMany(array $points): void;

    /**
     * K-nearest-neighbor search. Optional equality filters map
     * field => value and are applied to the stored payload.
     *
     * @param  list<float>  $vector
     * @param  array<string, mixed>  $filters  e.g. ['dish_family' => 'pasta']
     * @return list<array{recipe_id: int, score: float}>
     *
     * @throws VectorStoreException
     */
    public function search(array $vector, int $limit, array $filters = []): array;

    /**
     * @throws VectorStoreException
     */
    public function delete(int $recipeId): void;

    /**
     * Cheap connectivity check for ops tooling.
     */
    public function ping(): bool;
}
