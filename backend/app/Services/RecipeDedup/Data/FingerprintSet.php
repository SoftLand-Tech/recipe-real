<?php

namespace App\Services\RecipeDedup\Data;

/**
 * Deterministic hashes produced by FingerprintBuilder (the frozen
 * definitions all slices rely on):
 *
 * - fingerprint: sha256 over the FULL normalized identity payload
 *   (canonical dish, every normalized ingredient with bin'd quantity +
 *   canonical unit, technique set, cooking/prep method, sauce set, form).
 *   Two recipes share this only when they are the same recipe after
 *   normalization AND quantity binning.
 * - identity_signature: sha256 over the canonical-signature Tuple
 *   (canonical dish OR dish family + main ingredients + core technique
 *   classes + form + cuisine when confidently known). Catches the
 *   "Spaghetti Carbonara / Traditional Roman Carbonara" problem.
 * - ingredient_combo_hash: sha256 of sorted all-ingredient name set.
 * - main_ingredient_hash: sha256 of sorted main-ingredient name set.
 * - title_signature: sha256 of sorted title tokens (secondary candidate
 *   source ONLY — titles must never decide duplicates alone).
 */
final class FingerprintSet
{
    public function __construct(
        public readonly string $fingerprint,
        public readonly string $identitySignature,
        public readonly string $ingredientComboHash,
        public readonly string $mainIngredientHash,
        public readonly string $titleSignature,
        public readonly int $version,
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'fingerprint' => $this->fingerprint,
            'identity_signature' => $this->identitySignature,
            'ingredient_combo_hash' => $this->ingredientComboHash,
            'main_ingredient_hash' => $this->mainIngredientHash,
            'title_signature' => $this->titleSignature,
            'version' => $this->version,
        ];
    }

    /** @param array<string, mixed> $array */
    public static function fromArray(array $array): self
    {
        return new self(
            fingerprint: (string) $array['fingerprint'],
            identitySignature: (string) $array['identity_signature'],
            ingredientComboHash: (string) $array['ingredient_combo_hash'],
            mainIngredientHash: (string) $array['main_ingredient_hash'],
            titleSignature: (string) $array['title_signature'],
            version: (int) ($array['version'] ?? 1),
        );
    }
}
