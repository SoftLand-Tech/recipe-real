<?php

namespace App\Services\RecipeDedup\Data;

use App\Services\RecipeDedup\AiJudgeException;

/**
 * Strictly-validated payload of the AI duplicate judge.
 *
 * classification is one of: duplicate | meaningful_variation | distinct | uncertain
 */
final class AiJudgeResponse
{
    public const CLASSIFICATION_DUPLICATE = 'duplicate';

    public const CLASSIFICATION_MEANINGFUL_VARIATION = 'meaningful_variation';

    public const CLASSIFICATION_DISTINCT = 'distinct';

    public const CLASSIFICATION_UNCERTAIN = 'uncertain';

    public const CLASSIFICATIONS = [
        self::CLASSIFICATION_DUPLICATE,
        self::CLASSIFICATION_MEANINGFUL_VARIATION,
        self::CLASSIFICATION_DISTINCT,
        self::CLASSIFICATION_UNCERTAIN,
    ];

    /**
     * @param  string  $classification
     * @param  bool  $isDuplicate
     * @param  int|null  $matchedRecipeId
     * @param  float  $confidence  0.0..1.0
     * @param  string  $reason
     * @param  list<string>  $differences
     */
    public function __construct(
        public readonly string $classification,
        public readonly bool $isDuplicate,
        public readonly ?int $matchedRecipeId,
        public readonly float $confidence,
        public readonly string $reason,
        public readonly array $differences = [],
    ) {}

    /**
     * Validate + build from raw decoded JSON. Throws AiJudgeException with
     * a precise message when the payload does not honor the contract.
     *
     * @param  array<string, mixed>  $raw
     */
    public static function fromArray(array $raw): self
    {
        $classification = $raw['classification'] ?? null;

        if (! is_string($classification) || ! in_array($classification, self::CLASSIFICATIONS, true)) {
            throw new AiJudgeException(
                'The AI judge returned an invalid classification ['.json_encode($classification).'].'
            );
        }

        $matched = $raw['matched_recipe_id'] ?? null;
        if ($matched !== null && ! is_numeric($matched)) {
            throw new AiJudgeException('The AI judge returned a non-numeric matched_recipe_id.');
        }

        $confidenceRaw = $raw['confidence'] ?? null;
        if (! is_numeric($confidenceRaw)) {
            throw new AiJudgeException('The AI judge returned a non-numeric confidence.');
        }
        $confidence = max(0.0, min(1.0, (float) $confidenceRaw));

        $differences = array_values(array_filter(
            array_map(
                fn (mixed $item): ?string => is_string($item) ? $item : null,
                is_array($raw['differences'] ?? null) ? $raw['differences'] : [],
            ),
            fn (?string $item): bool => $item !== null && $item !== '',
        ));

        return new self(
            classification: $classification,
            isDuplicate: (bool) ($raw['is_duplicate'] ?? ($classification === self::CLASSIFICATION_DUPLICATE)),
            matchedRecipeId: $matched === null ? null : (int) $matched,
            confidence: $confidence,
            reason: is_string($raw['reason'] ?? null) ? trim((string) $raw['reason']) : '',
            differences: $differences,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'classification' => $this->classification,
            'is_duplicate' => $this->isDuplicate,
            'matched_recipe_id' => $this->matchedRecipeId,
            'confidence' => $this->confidence,
            'reason' => $this->reason,
            'differences' => $this->differences,
        ];
    }
}
