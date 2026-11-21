<?php

namespace App\Services\RecipeDedup\Fingerprinting;

use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\FingerprintSet;
use Illuminate\Database\QueryException;
use Throwable;

/**
 * Slice-2 entry point: deterministic, AI-free fingerprinting.
 *
 * The public API is FROZEN — slices 4-6 (candidate discovery, registrar,
 * generation) are written against these exact signatures:
 *
 *   identity(CandidateRecipe): CulinaryIdentity
 *   fingerprintSet(CandidateRecipe, ?CulinaryIdentity): FingerprintSet
 *   register(Recipe|int, ?CandidateRecipe): RecipeFingerprint
 *   forRecipe(Recipe|int): ?RecipeFingerprint
 *   identityOf(Recipe|int): ?CulinaryIdentity
 *   deserializeIdentity(string|array|null): ?CulinaryIdentity
 *
 * register() is a plain updateOrCreate keyed on recipe_id — safe for
 * hundreds of thousands of rows (no scans, no counts; the unique index on
 * fingerprint backs the race guard). When ANOTHER recipe already holds the
 * exact same fingerprint the underlying UNIQUE violation is rethrown as
 * FingerprintCollisionException (the slice-4 registrar interprets it as
 * "exact duplicate already registered"). Every other query exception rides
 * through untouched.
 */
final class FingerprintService
{
    public function __construct(
        private readonly CulinaryIdentityExtractor $extractor = new CulinaryIdentityExtractor,
        private readonly FingerprintBuilder $builder = new FingerprintBuilder,
    ) {}

    /**
     * Pure normalization — no DB, no IO. Deterministic for a given draft.
     */
    public function identity(CandidateRecipe $candidate): CulinaryIdentity
    {
        return $this->extractor->extract($candidate);
    }

    public function fingerprintSet(CandidateRecipe $candidate, ?CulinaryIdentity $identity = null): FingerprintSet
    {
        return $this->builder->build($candidate, $identity);
    }

    /**
     * Extract + upsert the fingerprint row for a recipe. When $candidate is
     * omitted it is built from the stored recipe (title, ingredients,
     * steps, category, keywords).
     *
     * @throws FingerprintCollisionException only when another recipe already
     *                                       holds this exact fingerprint
     * @throws QueryException for any other database failure
     */
    public function register(Recipe|int $recipe, ?CandidateRecipe $candidate = null): RecipeFingerprint
    {
        $model = $recipe instanceof Recipe ? $recipe : Recipe::query()->findOrFail($recipe);
        $candidate ??= CandidateRecipe::fromRecipe($model);

        $identity = $this->identity($candidate);
        $set = $this->fingerprintSet($candidate, $identity);

        try {
            return RecipeFingerprint::query()->updateOrCreate(
                ['recipe_id' => $model->id],
                $this->rowAttributes($identity, $set, $candidate),
            );
        } catch (QueryException $e) {
            if (self::isFingerprintUniqueViolation($e)) {
                throw new FingerprintCollisionException(
                    'Another recipe already holds this exact fingerprint.',
                    $e,
                );
            }

            throw $e;
        }
    }

    public function forRecipe(Recipe|int $recipe): ?RecipeFingerprint
    {
        $id = $recipe instanceof Recipe ? $recipe->id : $recipe;

        return RecipeFingerprint::query()->where('recipe_id', $id)->first();
    }

    /**
     * The stored identity payload deserialized back to the DTO; null when
     * the row (or its payload) is absent.
     */
    public function identityOf(Recipe|int $recipe): ?CulinaryIdentity
    {
        $fingerprint = $this->forRecipe($recipe);
        if ($fingerprint === null) {
            return null;
        }

        return $this->deserializeIdentity($fingerprint->identity);
    }

    /**
     * Deserializes whatever the identity column may contain (the model cast
     * already json-decodes strings) into a CulinaryIdentity, or null for
     * anything absent / unreadable — never throws.
     */
    public function deserializeIdentity(string|array|null $raw): ?CulinaryIdentity
    {
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);

            $raw = is_array($decoded) ? $decoded : null;
        }

        if (! is_array($raw) || $raw === []) {
            return null;
        }

        try {
            return CulinaryIdentity::fromArray($raw);
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * The denormalized, indexed columns beside the hashes: every consumer
     * query filters on these instead of re-parsing the identity payload.
     * `sauce` carries the FIRST sauce type only (null when none).
     *
     * @return array<string, mixed>
     */
    private function rowAttributes(CulinaryIdentity $identity, FingerprintSet $set, CandidateRecipe $candidate): array
    {
        return [
            'version' => $set->version,
            'fingerprint' => $set->fingerprint,
            'identity_signature' => $set->identitySignature,
            'ingredient_combo_hash' => $set->ingredientComboHash,
            'main_ingredient_hash' => $set->mainIngredientHash,
            'title_signature' => $set->titleSignature,
            'dish_family' => $identity->dishFamily,
            'cuisine' => $identity->cuisine,
            'category' => $identity->category,
            'form' => $identity->form,
            'sauce' => $identity->sauces[0] ?? null,
            'identity' => $identity->toArray(),
            'is_complete' => $this->isComplete($candidate),
        ];
    }

    /**
     * The fingerprint is trustworthy for dedup only when the source recipe
     * had a title, at least one ingredient and at least one step; anything
     * less is marked is_complete=false so the registrar can ignore it.
     */
    private function isComplete(CandidateRecipe $candidate): bool
    {
        return $candidate->title !== ''
            && (count($candidate->ingredientsRaw) > 0 || count($candidate->ingredientsStructured) > 0)
            && count($candidate->steps) > 0;
    }

    /**
     * Recognizes ONLY the unique violation on recipe_fingerprints.fingerprint:
     * - SQLite:  "UNIQUE constraint failed: recipe_fingerprints.fingerprint"
     * - MySQL:   "Duplicate entry '<hash>' for key 'recipe_fingerprints.fingerprint'"
     *            (8.0+; MariaDB / older MySQL print the index name
     *            'recipe_fingerprints_fingerprint_unique' — both contain the
     *            table name and the word fingerprint)
     */
    private static function isFingerprintUniqueViolation(QueryException $e): bool
    {
        $message = strtolower($e->getMessage());

        if (str_contains($message, 'unique constraint failed: recipe_fingerprints.fingerprint')) {
            return true;
        }

        return str_contains($message, 'duplicate entry')
            && str_contains($message, 'recipe_fingerprints')
            && str_contains($message, 'fingerprint');
    }
}
