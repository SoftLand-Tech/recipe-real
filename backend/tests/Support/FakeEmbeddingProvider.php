<?php

namespace Tests\Support;

use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\EmbeddingResult;

/**
 * Deterministic hashing embedding provider for tests: a normalized
 * bag-of-words hash in a fixed 32-dimension space (cosine of two texts is
 * ~ text token overlap). No HTTP anywhere.
 */
final class FakeEmbeddingProvider implements EmbeddingProvider
{
    public const DIMENSIONS = 32;

    /** @var int counts how many batches were requested (test assertions). */
    public int $batches = 0;

    public function __construct(private readonly string $model = 'fake-embeddings-v1') {}

    public function key(): string
    {
        return 'fake';
    }

    public function model(): string
    {
        return $this->model;
    }

    public function embed(array $texts): EmbeddingResult
    {
        $this->batches++;

        return new EmbeddingResult(
            vectors: array_map(fn (string $text): array => self::vectorize($text), $texts),
            model: $this->model,
            dimensions: self::DIMENSIONS,
        );
    }

    /** @return list<float> */
    public static function vectorize(string $text, int $dimensions = self::DIMENSIONS): array
    {
        $vector = array_fill(0, $dimensions, 0.0);
        $tokens = preg_split('/[^a-z0-9]+/i', mb_strtolower($text)) ?: [];

        foreach ($tokens as $token) {
            if ($token === '') {
                continue;
            }

            $index = self::tokenIndex($token, $dimensions);
            $vector[$index] += 1.0;
        }

        $norm = sqrt(array_sum(array_map(
            fn (float $value): float => $value * $value,
            $vector,
        )));

        if ($norm > 0) {
            $vector = array_map(fn (float $value): float => $value / $norm, $vector);
        }

        return $vector;
    }

    private static function tokenIndex(string $token, int $dimensions): int
    {
        $hash = 5381;

        foreach (str_split($token) as $char) {
            $hash = (($hash * 33) + ord($char)) & 0x7FFFFFFF;
        }

        return $hash % $dimensions;
    }
}
