<?php

namespace App\Services\RecipeDedup\Data;

/**
 * Weighted similarity between a candidate and one existing recipe, with
 * the full per-feature breakdown for observability.
 */
final class DuplicateScore
{
    /**
     * @param  float  $total  normalized weighted score 0.0..1.0
     * @param  array<string, float>  $features  feature => 0..1 value
     * @param  int  $corroborations  how many identity pillars matched
     * @param  bool  $passesCorroboration
     * @param  string  $explanation
     */
    public function __construct(
        public readonly float $total,
        public readonly array $features,
        public readonly int $corroborations,
        public readonly bool $passesCorroboration,
        public readonly string $explanation = '',
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'total' => round($this->total, 4),
            'features' => array_map(fn (float $value): float => round($value, 4), $this->features),
            'corroborations' => $this->corroborations,
            'passes_corroboration' => $this->passesCorroboration,
            'explanation' => $this->explanation,
        ];
    }
}
