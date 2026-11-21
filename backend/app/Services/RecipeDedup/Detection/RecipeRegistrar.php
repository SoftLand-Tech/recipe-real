<?php

namespace App\Services\RecipeDedup\Detection;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Models\RecipeGenerationBatch;
use App\Models\RecipeStep;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\DuplicateDecision;
use App\Services\RecipeDedup\Embeddings\EmbeddingService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintCollisionException;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The ONLY place that turns an accepted candidate into rows.
 *
 * IN-BATCH DUPLICATE INVARIANT (slice 5 relies on this): every accepted
 * candidate IS INSERTED here — Recipe row + RecipeStep rows +
 * recipe_fingerprints UNIQUE row + (embed_immediately) vector point —
 * BEFORE register() returns and the generation loop evaluates the NEXT
 * candidate. So an in-batch duplicate cannot slip through layer 1 (the
 * fingerprint UNIQUE constraint + the exact-fingerprint lookup both see
 * the committed sibling) nor layer 2 (the sibling is retrievable).
 * Evaluate-then-insert per candidate, never batch-then-insert.
 *
 * Race-minimal accept path: the fingerprint insert is the last write
 * inside the create transaction. If another writer claimed the exact
 * fingerprint between our evaluate() and our insert, the UNIQUE
 * constraint fires, the whole transaction rolls back (no orphan Recipe/
 * RecipeStep rows) and register() re-decides the candidate as a layer-1
 * duplicate against the winning fingerprint holder — quietly returning
 * a clean duplicate RecipeRegistrationResult instead of throwing.
 *
 * Like DuplicateDetectionService, this class never throws on decision
 * outcomes — only on caller-contract violations (terminal batch).
 */
final class RecipeRegistrar
{
    public function __construct(
        private readonly DuplicateDetectionService $detection,
        private readonly FingerprintService $fingerprints,
        private readonly EmbeddingService $embeddingService,
    ) {}

    /**
     * Evaluate + (when accepted) persist a candidate.
     *
     * @param  RecipeGenerationBatch|null  $batch  generation flow marker: switches the
     *                                             check-row source to 'generation', the recipe
     *                                             source_type to config generation.source_type,
     *                                             and stamps batch_id on the check row
     * @param  int|null  $ownerId  optional recipe owner (the generation slice resolves
     *                             the batch owner_email to an id upstream — slices decide
     *                             ownership, the registrar only persists it)
     *
     * @throws GenerationException when the batch is already terminal
     */
    public function register(
        CandidateRecipe $candidate,
        ?RecipeGenerationBatch $batch = null,
        ?int $ownerId = null,
    ): RecipeRegistrationResult {
        if ($batch !== null && $batch->isTerminal()) {
            throw new GenerationException(
                sprintf('Generation batch #%s is already terminal — refusing to register candidates.', $batch->id),
            );
        }

        $source = $batch !== null
            ? DuplicateCheck::SOURCE_GENERATION
            // 'auto_review' mirrors DuplicateDetectionService::evaluate()'s
            // default (no constant exists on DuplicateCheck for it).
            : 'auto_review';

        $decision = $this->detection->evaluate($candidate, $source);

        // Duplicate / needs_review: NO recipe write — the caller (slice 5 /
        // manual review UI) consumes the decision and, for review rows, the
        // freshly recorded check row id.
        if (! $decision->accepted()) {
            $this->attachBatch($decision, $batch);

            return new RecipeRegistrationResult(decision: $decision, recipe: null);
        }

        $identity = $this->fingerprints->identity($candidate);
        $set = $this->fingerprints->fingerprintSet($candidate, $identity);
        $newRecipeId = null;

        try {
            [$recipe, $fingerprintRow] = DB::transaction(function () use (
                $candidate,
                $batch,
                $ownerId,
                &$newRecipeId,
            ): array {
                $recipe = Recipe::create($this->recipeAttributes($candidate, $batch, $ownerId));
                $newRecipeId = (int) $recipe->id;

                $steps = self::stepDescriptions($candidate);

                foreach ($steps as $index => $description) {
                    RecipeStep::query()->create([
                        'recipe_id' => $recipe->id,
                        'step_number' => $index + 1,
                        'description' => $description,
                        // Slice 4 writes plain active steps; the AI-apply
                        // pipeline may later reclassify/passivate them.
                        'step_type' => 'active',
                        'ai_minutes' => null,
                        'literal_minutes' => null,
                    ]);
                }

                // The fingerprint row is BOTH the dedup evidence and the
                // DB-level duplicate guard: a competing writer claiming the
                // same exact fingerprint makes THIS insert throw
                // FingerprintCollisionException, rolling back the recipe +
                // step rows with it.
                $fingerprintRow = $this->fingerprints->register($recipe, $candidate);

                return [$recipe, $fingerprintRow];
            });
        } catch (FingerprintCollisionException $collision) {
            return $this->collisionDecision($candidate, $source, $batch, $set->fingerprint, $newRecipeId, $collision);
        }

        // Post-commit indexing (fail-soft — an embedding outage must never
        // fail a committed registration).
        if ((bool) config('recipe_dedup.indexing.enabled', false)
            && (bool) config('recipe_dedup.indexing.embed_immediately', true)
        ) {
            try {
                $this->embeddingService->ensureIndexedGivenIdentity($recipe, $identity, $fingerprintRow);
            } catch (Throwable $e) {
                Log::warning('recipe dedup: post-commit embedding failed — recipe stays unindexed', [
                    'recipe_id' => (int) $recipe->id,
                    'error' => (string) $e->getMessage(),
                ]);
            }
        }
        // embed_immediately=false → no inline embedding here; slice 6's
        // queued indexing job owns that path.

        $this->attachBatch($decision, $batch, (int) $recipe->id);

        return new RecipeRegistrationResult(decision: $decision, recipe: $recipe);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * The Recipe::create mapping. ingredients_structured items come from
     * the normalization ALREADY present in CandidateRecipe::ingredientsStructured
     * (fromDraft fills item) — the registrar NEVER re-runs the normalizer;
     * raw-only candidates keep items with raw + empty item.
     *
     * @return array<string, mixed>
     */
    private function recipeAttributes(
        CandidateRecipe $candidate,
        ?RecipeGenerationBatch $batch,
        ?int $ownerId,
    ): array {
        $steps = self::stepDescriptions($candidate);

        return [
            'owner_id' => $ownerId,
            // Generated batches carry the configured batch marker; direct
            // registrations (no batch) behave like community user recipes.
            'source_type' => $batch !== null
                ? (string) config('recipe_dedup.generation.source_type', 'ai_batch')
                : 'user',
            'title' => $candidate->title,
            'description' => $candidate->description,
            // Raw lines as the JSON list (array cast → JSON on write),
            // matching how user/imported recipes store ingredients.
            'ingredients' => array_values($candidate->ingredientsRaw),
            // Descriptions list mirrors the import pipeline (the normalized
            // per-step rows live in recipe_steps).
            'steps' => $steps,
            'steps_count' => count($steps),
            'category' => $candidate->category,
            'keywords' => array_values($candidate->keywords),
            'servings' => $candidate->servings,
            'prep_time_minutes' => $candidate->prepTimeMinutes,
            'cook_time_minutes' => $candidate->cookTimeMinutes,
            // User-recipe convention: the total claim drives the publisher
            // estimate column.
            'publisher_time_minutes' => $candidate->totalTimeMinutes,
            'ingredients_structured' => ['v' => 1, 'items' => $this->structuredItems($candidate)],
        ];
    }

    /**
     * @return list<string>
     */
    private static function stepDescriptions(CandidateRecipe $candidate): array
    {
        return array_values(array_filter(
            array_map(trim(...), $candidate->steps),
            static fn (string $description): bool => $description !== '',
        ));
    }

    /**
     * The v:1 ingredients_structured payload, shaped exactly like the
     * import pipeline's (raw/qty/qty_display/unit/item/prep), derived from
     * the candidate's already-normalized items.
     *
     * @return list<array<string, mixed>>
     */
    private function structuredItems(CandidateRecipe $candidate): array
    {
        $structured = $candidate->ingredientsStructured;

        if ($structured === []) {
            // Raw-only candidate: keep items with raw + empty item.
            return array_values(array_map(
                static fn (string $raw): array => [
                    'raw' => $raw,
                    'qty' => null,
                    'qty_display' => null,
                    'unit' => null,
                    'item' => null,
                    'prep' => null,
                ],
                $candidate->ingredientsRaw,
            ));
        }

        return array_values(array_map(
            static function (array $item): array {
                $qty = isset($item['qty']) && is_numeric($item['qty']) ? (float) $item['qty'] : null;
                $qtyDisplay = $item['qty_display'] ?? self::defaultQtyDisplay($qty);

                return [
                    'raw' => isset($item['raw']) && is_string($item['raw']) ? $item['raw'] : null,
                    'qty' => $qty,
                    'qty_display' => $qtyDisplay === '' ? null : $qtyDisplay,
                    'unit' => isset($item['unit']) && is_string($item['unit']) ? $item['unit'] : null,
                    'item' => isset($item['item']) && is_string($item['item']) ? $item['item'] : null,
                    'prep' => isset($item['prep']) && is_string($item['prep']) ? $item['prep'] : null,
                ];
            },
            $structured,
        ));
    }

    /**
     * qty_display fallback when the normalizer did not provide one.
     */
    private static function defaultQtyDisplay(?float $qty): ?string
    {
        if ($qty === null) {
            return null;
        }

        $formatted = number_format($qty, 2, '.', '');
        $formatted = rtrim(rtrim($formatted, '0'), '.');

        return $formatted === '' || $formatted === '-' ? null : $formatted;
    }

    /**
     * The race path: another writer committed the exact fingerprint
     * between our evaluate() and our insert. The create transaction
     * already rolled back — re-decide the candidate as a layer-1
     * duplicate of the winning fingerprint holder and record a FRESH
     * check row (source/batch context preserved; reason names the
     * collision). Quiet return: the race resolves to a duplicate result,
     * never an exception.
     *
     * Self-collision (the winning fingerprint belongs to the candidate
     * that was JUST inserted — practically impossible after rollback) is
     * treated as needs_review instead of a bogus self-match.
     */
    private function collisionDecision(
        CandidateRecipe $candidate,
        string $source,
        ?RecipeGenerationBatch $batch,
        string $fingerprint,
        ?int $newRecipeId,
        FingerprintCollisionException $collision,
    ): RecipeRegistrationResult {
        $holder = RecipeFingerprint::query()
            ->where('fingerprint', $fingerprint)
            ->orderBy('id')
            ->first();

        $holderId = $holder !== null ? (int) $holder->recipe_id : null;
        $selfCollision = $holderId !== null && $newRecipeId !== null && $holderId === $newRecipeId;

        Log::warning('recipe dedup: fingerprint collision on insert', [
            'fingerprint' => $fingerprint,
            'holder_recipe_id' => $holderId,
            'attempted_recipe_id' => $newRecipeId,
            'error' => (string) $collision->getMessage(),
        ]);

        if ($selfCollision || $holder === null) {
            $decision = new DuplicateDecision(
                action: DuplicateDecision::ACTION_NEEDS_REVIEW,
                layer: 1,
                confidence: 1.0,
                reason: 'fingerprint collision on insert — winner unresolved, flagged for review',
            );
        } else {
            $decision = new DuplicateDecision(
                action: DuplicateDecision::ACTION_DUPLICATE,
                layer: 1,
                matchedRecipeId: $holderId,
                confidence: 1.0,
                reason: 'fingerprint collision on insert',
                isDuplicate: true,
            );
        }

        $check = DuplicateCheck::query()->create([
            'recipe_id' => null, // the attempted insert rolled back — nothing to point at
            'matched_recipe_id' => $decision->matchedRecipeId,
            'batch_id' => $batch?->id,
            'source' => mb_substr($source, 0, 16),
            'layer' => 1,
            'action' => $decision->action === DuplicateDecision::ACTION_DUPLICATE
                ? DuplicateCheck::ACTION_REJECTED_DUPLICATE
                : DuplicateCheck::ACTION_FLAGGED_REVIEW,
            'is_duplicate' => $decision->isDuplicate,
            'scores' => null,
            'classification' => null,
            'ai_confidence' => $decision->confidence,
            'reason' => mb_substr($decision->reason ?? '', 0, 2000),
            'differences' => [],
            'status' => $decision->action === DuplicateDecision::ACTION_NEEDS_REVIEW
                ? DuplicateCheck::STATUS_NEEDS_REVIEW
                : DuplicateCheck::STATUS_RESOLVED,
        ]);

        return new RecipeRegistrationResult(
            decision: $check === null ? $decision : $decision->withCheckId((int) $check->id),
            recipe: null,
        );
    }

    /**
     * The only check-row UPDATE the registrar performs: attaching batch
     * context to the row evaluate() just created. No re-recording, no
     * decision changes.
     */
    /**
     * The audit-row backfill for facts that only the registrar knows: the
     * committed recipe's own id (accepted path) and the generation batch.
     * Slice 5's runner attaches FURTHER context (its own batch flow) via
     * the same checkId mechanism.
     */
    private function attachBatch(DuplicateDecision $decision, ?RecipeGenerationBatch $batch, ?int $recipeId = null): void
    {
        if ($decision->checkId === null) {
            return;
        }

        $update = [];

        if ($recipeId !== null) {
            $update['recipe_id'] = $recipeId;
        }

        if ($batch !== null) {
            $update['batch_id'] = $batch->id;
        }

        if ($update === []) {
            return;
        }

        DuplicateCheck::query()
            ->whereKey($decision->checkId)
            ->update($update);
    }
}
