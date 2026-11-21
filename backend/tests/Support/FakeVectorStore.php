<?php

namespace Tests\Support;

use App\Services\RecipeDedup\Contracts\VectorStore;

/**
 * In-memory Qdrant stand-in: cosine search with payload equality filters,
 * idempotent upserts keyed by recipe id. Enough for every engine test to
 * run against real search semantics without a daemon.
 */
final class FakeVectorStore implements VectorStore
{
    /** @var array<int, array{vector: list<float>, payload: array<string, mixed>}> */
    public array $points = [];

    public int $dimensions = FakeEmbeddingProvider::DIMENSIONS;

    public bool $healthy = true;

    /**
     * Counts ensureCollection() calls (test assertions). UNtyped so the
     * int value is legal.
     */
    public $ensureCollectionCalls = 0;

    public function enabled(): bool
    {
        return true;
    }

    public function collection(): string
    {
        return (string) config('recipe_dedup.vector.qdrant.collection', 'recipe_embeddings');
    }

    public function ensureCollection(int $dimensions): void
    {
        $this->ensureCollectionCalls++;
        $this->dimensions = $dimensions;
    }

    public function upsertMany(array $points): void
    {
        foreach ($points as $point) {
            $this->points[$point['id']] = [
                'vector' => $point['vector'],
                'payload' => $point['payload'],
            ];
        }
    }

    public function search(array $vector, int $limit, array $filters = []): array
    {
        $scores = [];

        foreach ($this->points as $id => $point) {
            if ($this->matchesFilters($point['payload'], $filters)) {
                $scores[] = ['recipe_id' => (int) $id, 'score' => self::cosine($vector, $point['vector'])];
            }
        }

        usort($scores, fn (array $a, array $b): int => $b['score'] <=> $a['score']);

        return array_slice($scores, 0, $limit);
    }

    public function delete(int $recipeId): void
    {
        unset($this->points[$recipeId]);
    }

    public function ping(): bool
    {
        return $this->healthy;
    }

    private function matchesFilters(array $payload, array $filters): bool
    {
        foreach ($filters as $key => $value) {
            if (($payload[$key] ?? null) !== $value) {
                return false;
            }
        }

        return true;
    }

    /** @param list<float> $a @param list<float> $b */
    public static function cosine(array $a, array $b): float
    {
        $len = min(count($a), count($b));
        $dot = 0.0;
        $na = 0.0;
        $nb = 0.0;

        for ($i = 0; $i < $len; $i++) {
            $dot += $a[$i] * $b[$i];
            $na += $a[$i] * $a[$i];
            $nb += $b[$i] * $b[$i];
        }

        if ($na <= 0 || $nb <= 0) {
            return 0.0;
        }

        return $dot / (sqrt($na) * sqrt($nb));
    }
}
