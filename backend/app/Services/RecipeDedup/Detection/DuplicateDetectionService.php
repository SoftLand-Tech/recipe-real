<?php

namespace App\Services\RecipeDedup\Detection;

use App\Models\DuplicateCheck;
use App\Models\Recipe;
use App\Models\RecipeFingerprint;
use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Data\AiJudgeResponse;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\CulinaryIdentity;
use App\Services\RecipeDedup\Data\DuplicateDecision;
use App\Services\RecipeDedup\Data\DuplicateScore;
use App\Services\RecipeDedup\Embeddings\EmbeddingTextBuilder;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The 3-layer duplicate decision engine (slice 4's orchestrator):
 *
 *  Layer 1 — exact: recipe_fingerprints.fingerprint equality (the DB
 *           UNIQUE guard included). is_complete rows reject; degraded
 *           rows only flag for review.
 *  Layer 2 — structural + semantic: CandidateRetriever sources ->
 *           weighted SimilarityScorer -> thresholds + corroboration.
 *  Layer 3 — AI verification: AiDuplicateJudge over the above-verify
 *           shortlist, with the deterministic on_failure policy.
 *
 * evaluate() NEVER throws: every decision is recorded in
 * duplicate_checks (append-only audit — this class never UPDATEs rows it
 * already wrote; the registrar/slice-5 attach recipe_id/batch_id via the
 * returned checkId instead), and any unexpected error becomes a
 * needs_review decision. The service performs NO writes to recipes —
 * persistence is RecipeRegistrar's job.
 *
 * Batching invariant slice 5 relies on: in-batch duplicates are caught
 * (layer 1/2) only AFTER a candidate is actually INSERTED (recipe +
 * fingerprint + vector point). Evaluate-then-insert per candidate, never
 * batch-then-insert; see RecipeRegistrar.
 *
 * Layer-2 vector features: the candidate embedding comes from retrieval
 * (source E) — or rides along in ONE batched provider call that also
 * embeds every retrieved identity — so vector_cosine is computed when
 * BOTH vectors are obtainable and EXCLUDED otherwise (never scored 0).
 * All embedding calls here are fail-soft (feature dropped on failure);
 * the structured features always run.
 */
final class DuplicateDetectionService
{
    public function __construct(
        private readonly FingerprintService $fingerprints,
        private readonly CandidateRetriever $retriever,
        private readonly SimilarityScorer $scorer,
        private readonly AiDuplicateJudge $judge,
        private readonly EmbeddingProvider $embeddings,
    ) {}

    /**
     * The single entry point other slices call. $source ∈
     * generation|backfill|auto_review|manual (stored on duplicate_checks,
     * string(16)).
     */
    public function evaluate(CandidateRecipe $candidate, ?string $source = 'auto_review'): DuplicateDecision
    {
        try {
            return $this->run($candidate, (string) ($source ?? 'auto_review'));
        } catch (Throwable $e) {
            return $this->errorDecision($candidate, (string) ($source ?? 'auto_review'), $e);
        }
    }

    /**
     * The identities for a set of recipes — the {id, title, identity}
     * rows the scorer + judge consume (joins via recipe_fingerprints;
     * rows with a missing/unreadable identity payload are skipped).
     *
     * @param  list<int>  $recipeIds
     * @return list<array{id:int, title:string, identity:CulinaryIdentity}>
     */
    public function identitiesFor(array $recipeIds): array
    {
        return $this->retriever->identitiesForRecipes($recipeIds);
    }

    /**
     * The engine master switch + thresholds sanity: on only when the
     * config enables the dedup engine AND its thresholds are sane
     * (0 < auto_duplicate <= 1 and 0 <= verify < auto_duplicate — anything
     * else would let layer 2 reject more than it verifies).
     */
    public function detectionEnabled(): bool
    {
        if (! (bool) config('recipe_dedup.enabled', false)) {
            return false;
        }

        $auto = (float) config('recipe_dedup.thresholds.auto_duplicate', 0.88);
        $verify = (float) config('recipe_dedup.thresholds.verify', 0.68);

        return $auto > 0.0
            && $auto <= 1.0
            && $verify >= 0.0
            && $verify < $auto;
    }

    // ------------------------------------------------------------------
    // The layered flow (everything below runs inside the try/catch above)
    // ------------------------------------------------------------------

    private function run(CandidateRecipe $candidate, string $source): DuplicateDecision
    {
        $identity = $this->fingerprints->identity($candidate);
        $set = $this->fingerprints->fingerprintSet($candidate, $identity);

        // Self-exclusion for re-evaluated existing recipes (backfill slice
        // passes the recipe id via meta; fresh drafts have none).
        $selfId = isset($candidate->meta['recipe_id']) && is_numeric($candidate->meta['recipe_id'])
            ? (int) $candidate->meta['recipe_id']
            : null;

        // Degraded source data (empty title/ingredients/steps): the
        // fingerprint of a half-recipe is unreliable evidence, so layer 1/2
        // may FLAG but never auto-reject on it.
        $degenerate = self::isDegenerate($candidate);

        $layer1Hit = $this->layer1($set->fingerprint, $selfId);

        if ($layer1Hit !== null) {
            if ($layer1Hit['complete'] !== null && ! $degenerate) {
                return $this->record($candidate, $source, new DuplicateDecision(
                    action: DuplicateDecision::ACTION_DUPLICATE,
                    layer: 1,
                    matchedRecipeId: (int) $layer1Hit['complete']->recipe_id,
                    confidence: 1.0,
                    reason: 'Exact normalized fingerprint match',
                    isDuplicate: true,
                ));
            }

            $matchedId = $layer1Hit['complete'] !== null
                ? (int) $layer1Hit['complete']->recipe_id
                : (int) ($layer1Hit['all']->first()->recipe_id ?? 0);

            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_NEEDS_REVIEW,
                layer: 1,
                matchedRecipeId: $matchedId,
                confidence: 1.0,
                reason: $degenerate
                    ? 'Exact fingerprint match but candidate metadata is degraded — flagged for review'
                    : 'Exact fingerprint match on a degraded fingerprint row — flagged for review',
            ));
        }

        // ---- Layer 2: retrieval + weighted scoring.
        if (! (bool) config('recipe_dedup.retrieval.enabled', false)) {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_ACCEPTED,
                layer: 2,
                reason: 'Candidate retrieval disabled — no comparable recipes',
            ));
        }

        $exclude = $selfId === null ? null : Recipe::query()->find($selfId);
        $retrieval = $this->retriever->retrieve($candidate, $identity, $set, $exclude);

        if ($retrieval->isEmpty()) {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_ACCEPTED,
                layer: 2,
                reason: 'No similar existing recipes found',
            ));
        }

        $vectors = $this->semanticVectors($identity, $retrieval, $candidate);

        $entries = $retrieval->identities;
        $scores = [];

        foreach ($entries as $index => $entry) {
            $scores[$index] = $this->scorer->score(
                $identity,
                $entry['identity'],
                $vectors['candidate'],
                $vectors['existing'][(int) $entry['id']] ?? null,
            );
        }

        $bestIndex = null;

        foreach ($scores as $index => $score) {
            if ($bestIndex === null || $score->total > $scores[$bestIndex]->total) {
                $bestIndex = $index;
            }
        }

        $best = $bestIndex === null ? null : $scores[$bestIndex];
        $bestEntry = $bestIndex === null ? null : $entries[$bestIndex];

        $auto = (float) config('recipe_dedup.thresholds.auto_duplicate', 0.88);
        $verify = (float) config('recipe_dedup.thresholds.verify', 0.68);

        if ($best instanceof DuplicateScore && $best->total >= $auto && $best->passesCorroboration) {
            if ($degenerate) {
                return $this->record($candidate, $source, new DuplicateDecision(
                    action: DuplicateDecision::ACTION_NEEDS_REVIEW,
                    layer: 2,
                    matchedRecipeId: (int) $bestEntry['id'],
                    score: $best,
                    reason: sprintf(
                        'Structural match above the auto-duplicate threshold (score %.2f) but candidate metadata is degraded — flagged for review',
                        $best->total,
                    ),
                ));
            }

            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_DUPLICATE,
                layer: 2,
                matchedRecipeId: (int) $bestEntry['id'],
                score: $best,
                reason: sprintf(
                    'Structural+semantic match corroborated: score %.2f >= auto_duplicate %.2f (%d/%d corroboration pillars)',
                    $best->total,
                    $auto,
                    $best->corroborations,
                    max(0, (int) config('recipe_dedup.corroboration.min_rules', 2)),
                ),
                isDuplicate: true,
            ));
        }

        // ---- Layer 3: AI judge shortlist (only the verify-band candidates).
        if ($best instanceof DuplicateScore && $bestEntry !== null && $best->total >= $verify) {
            $shortlist = $this->shortlist($entries, $scores, $verify);

            return $this->layer3($candidate, $identity, $source, $best, $shortlist);
        }

        return $this->record($candidate, $source, new DuplicateDecision(
            action: DuplicateDecision::ACTION_ACCEPTED,
            layer: 2,
            score: $best,
            reason: sprintf(
                'Best structural match scored %.2f below the verify threshold %.2f',
                $best?->total ?? 0.0,
                $verify,
            ),
        ));
    }

    /**
     * Layer 1: the exact fingerprint lookup. Returns the rows sharing the
     * candidate's fingerprint (self-excluded) or null when none exist;
     * the caller branches complete/degraded.
     *
     * @return array{complete: ?RecipeFingerprint, all: Collection<int, RecipeFingerprint>}|null
     */
    private function layer1(string $fingerprint, ?int $selfId): ?array
    {
        $rows = RecipeFingerprint::query()
            ->where('fingerprint', $fingerprint)
            ->when($selfId !== null, fn ($query) => $query->where('recipe_id', '!=', $selfId))
            ->get();

        if ($rows->isEmpty()) {
            return null;
        }

        return ['complete' => $rows->firstWhere('is_complete', true), 'all' => $rows];
    }

    /**
     * Layer 3 shortlist: candidates scoring >= verify, best first, capped
     * at ai_judge.max_candidates. Returns [[entry, score], ...].
     *
     * @param  list<array{id:int, title:string, identity:CulinaryIdentity}>  $entries
     * @return list<array{entry: array{id:int, title:string, identity:CulinaryIdentity}, score: DuplicateScore}>
     */
    private function shortlist(array $entries, array $scores, float $verify): array
    {
        $capped = [];

        foreach ($scores as $index => $score) {
            if ($score->total < $verify) {
                continue;
            }

            $capped[] = ['entry' => $entries[$index], 'score' => $score];
        }

        usort($capped, fn (array $a, array $b): int => $b['score']->total <=> $a['score']->total);

        return array_slice($capped, 0, max(1, (int) config('recipe_dedup.ai_judge.max_candidates', 5)));
    }

    /**
     * The vectors for layer-2 scoring, when available: the candidate's
     * own (retrieval already embedded it for source E) plus ONE batched
     * provider call for every retrieved identity. Any failure drops the
     * feature (never scores 0).
     *
     * @return array{candidate: list<float>|null, existing: array<int, list<float>>}
     */
    private function semanticVectors(
        CulinaryIdentity $identity,
        CandidateRetrieval $retrieval,
        CandidateRecipe $candidate,
    ): array {
        if (! (bool) config('recipe_dedup.embeddings.enabled', true)
            || $this->embeddings->key() === 'none'
        ) {
            return ['candidate' => null, 'existing' => []];
        }

        $candidateText = EmbeddingTextBuilder::build($identity, $candidate->language);

        $texts = [];
        $order = []; // slot index => 0 (candidate) | existing recipe id

        if ($candidateText !== '') {
            if ($retrieval->vector !== null) {
                // Source E already produced the candidate vector — free ride.
                $candidateVector = $retrieval->vector;
            } else {
                $texts[] = $candidateText;
                $order[] = 0;
                $candidateVector = null;
            }
        }

        foreach ($retrieval->identities as $entry) {
            $entryText = EmbeddingTextBuilder::build($entry['identity']);

            if ($entryText !== '') {
                $texts[] = $entryText;
                $order[] = (int) $entry['id'];
            }
        }

        if ($texts === []) {
            // Nothing to batch (candidate had a vector from retrieval and
            // no retrieved identity is embeddable): feature stays excluded.
            return ['candidate' => $candidateVector ?? null, 'existing' => []];
        }

        try {
            $result = $this->embeddings->embed($texts);
        } catch (Throwable $e) {
            Log::warning('recipe dedup: semantic scoring embeddings failed — vector feature excluded', [
                'error' => (string) $e->getMessage(),
            ]);

            return ['candidate' => $candidateVector ?? null, 'existing' => []];
        }

        $vectors = array_values(is_array($result->vectors) ? $result->vectors : []);

        $byId = [];

        foreach ($order as $i => $recipeId) {
            if (! is_array($vectors[$i] ?? null)) {
                continue;
            }

            $vector = array_map(floatval(...), $vectors[$i]);

            if ($recipeId === 0) {
                $candidateVector ??= $vector; // first slot = the candidate's own vector

                continue;
            }

            $byId[$recipeId] = $vector;
        }

        return ['candidate' => $candidateVector ?? null, 'existing' => $byId];
    }

    /**
     * Layer 3. $shortlist = [[entry, score], ...] (already capped).
     *
     * @param  list<array{entry: array{id:int, title:string, identity:CulinaryIdentity}, score: DuplicateScore}>  $shortlist
     */
    private function layer3(
        CandidateRecipe $candidate,
        CulinaryIdentity $identity,
        string $source,
        DuplicateScore $best,
        array $shortlist,
    ): DuplicateDecision {
        if (! (bool) config('recipe_dedup.ai_judge.enabled', false)) {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_ACCEPTED,
                layer: 2,
                score: $best,
                reason: sprintf(
                    'Structural match scored %.2f reaches the AI judge threshold but the judge is disabled — accepted with the best score recorded',
                    $best->total,
                ),
            ));
        }

        $entries = array_map(fn (array $row): array => $row['entry'], $shortlist);

        try {
            $response = $this->judge->judge($candidate, $identity, $entries);
        } catch (AiJudgeException $e) {
            return $this->judgeFailure($candidate, $source, $best, $e);
        }

        return $this->judgeVerdict($candidate, $source, $best, $shortlist, $response);
    }

    /**
     * The judge's verdict → decision (documented mapping in the brief).
     *
     * @param  list<array{entry: array{id:int, title:string, identity:CulinaryIdentity}, score: DuplicateScore}>  $shortlist
     */
    private function judgeVerdict(
        CandidateRecipe $candidate,
        string $source,
        DuplicateScore $best,
        array $shortlist,
        AiJudgeResponse $response,
    ): DuplicateDecision {
        $shortlistIds = array_map(fn (array $row): int => (int) $row['entry']['id'], $shortlist);

        if ($response->classification === AiJudgeResponse::CLASSIFICATION_DUPLICATE && $response->isDuplicate) {
            $minConfidence = (float) config('recipe_dedup.ai_judge.min_auto_confidence', 0.85);
            $matchedId = $response->matchedRecipeId;
            $inShortlist = $matchedId !== null && in_array($matchedId, $shortlistIds, true);

            if ($response->confidence >= $minConfidence && $inShortlist) {
                return $this->record($candidate, $source, new DuplicateDecision(
                    action: DuplicateDecision::ACTION_DUPLICATE,
                    layer: 3,
                    matchedRecipeId: $matchedId,
                    score: $best,
                    classification: $response->classification,
                    confidence: $response->confidence,
                    reason: $response->reason !== '' ? $response->reason : 'AI judge confirmed a duplicate',
                    differences: $response->differences,
                    isDuplicate: true,
                ));
            }

            // Duplicate verdict we cannot safely auto-apply: low
            // confidence, missing/hallucinated match id.
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_NEEDS_REVIEW,
                layer: 3,
                matchedRecipeId: $inShortlist ? $matchedId : null,
                score: $best,
                classification: $response->classification,
                confidence: $response->confidence,
                reason: $inShortlist
                    ? sprintf(
                        'AI judge flagged a duplicate below the auto-confidence floor (%.2f < %.2f)',
                        $response->confidence,
                        $minConfidence,
                    )
                    : 'AI judge flagged a duplicate but named no offered recipe — flagged for review',
                differences: $response->differences,
                isDuplicate: false,
            ));
        }

        if ($response->classification === AiJudgeResponse::CLASSIFICATION_UNCERTAIN) {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_NEEDS_REVIEW,
                layer: 3,
                score: $best,
                classification: $response->classification,
                confidence: $response->confidence,
                reason: $response->reason !== '' ? $response->reason : 'AI judge could not decide',
                differences: $response->differences,
            ));
        }

        // meaningful_variation | distinct — genuinely new content; keep the
        // classification + reason + differences for the record.
        return $this->record($candidate, $source, new DuplicateDecision(
            action: DuplicateDecision::ACTION_ACCEPTED,
            layer: 3,
            matchedRecipeId: $response->matchedRecipeId,
            score: $best,
            classification: $response->classification,
            confidence: $response->confidence,
            reason: $response->reason !== '' ? $response->reason : sprintf('AI judge verdict: %s', $response->classification),
            differences: $response->differences,
        ));
    }

    /**
     * config('recipe_dedup.ai_judge.on_failure'): flag (default) |
     * accept | reject — the deterministic policy for judge outages.
     */
    private function judgeFailure(
        CandidateRecipe $candidate,
        string $source,
        DuplicateScore $best,
        AiJudgeException $e,
    ): DuplicateDecision {
        $onFailure = (string) config('recipe_dedup.ai_judge.on_failure', 'flag');

        if ($onFailure === 'accept') {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_ACCEPTED,
                layer: 3,
                score: $best,
                reason: sprintf('AI judge unavailable (%s) — accepted on the %s policy', $e->getMessage(), $onFailure),
            ));
        }

        if ($onFailure === 'reject') {
            return $this->record($candidate, $source, new DuplicateDecision(
                action: DuplicateDecision::ACTION_DUPLICATE,
                layer: 3,
                score: $best,
                reason: sprintf('AI judge unavailable (%s) — rejected on the %s policy', $e->getMessage(), $onFailure),
                isDuplicate: true,
            ));
        }

        return $this->record($candidate, $source, new DuplicateDecision(
            action: DuplicateDecision::ACTION_NEEDS_REVIEW,
            layer: 3,
            score: $best,
            reason: sprintf('AI judge unavailable — flagged for review (%s)', $e->getMessage()),
        ));
    }

    /**
     * The unconditional failure path of evaluate(): unexpected Throwable →
     * needs_review + best-effort audit row (recording must not throw).
     */
    private function errorDecision(CandidateRecipe $candidate, string $source, Throwable $e): DuplicateDecision
    {
        $reason = mb_substr('Detection error: '.$e->getMessage(), 0, 2000);
        $checkId = null;

        try {
            $check = self::createCheckRow($candidate, $source, [
                'layer' => 0, // no layer decided ("none")
                'action' => DuplicateCheck::ACTION_FLAGGED_REVIEW,
                'is_duplicate' => null,
                'classification' => null,
                'ai_confidence' => null,
                'reason' => $reason,
            ]);
            $checkId = $check?->id;
        } catch (Throwable) {
            // Recording is best-effort on this path by contract.
        }

        return new DuplicateDecision(
            action: DuplicateDecision::ACTION_NEEDS_REVIEW,
            layer: 0,
            reason: $reason,
            checkId: $checkId,
        );
    }

    // ------------------------------------------------------------------
    // Decision recording (duplicate_checks)
    // ------------------------------------------------------------------

    private function record(
        CandidateRecipe $candidate,
        string $source,
        DuplicateDecision $decision,
    ): DuplicateDecision {
        $check = self::createCheckRow($candidate, $source, self::checkRowAttributes($decision));
        $checkId = $check?->id;

        return $checkId === null ? $decision : $decision->withCheckId($checkId);
    }

    /**
     * The duplicate_checks row shape: append-only history, one row per
     * decision; recipe_id/batch_id stay null here (known-owner slices
     * attach them via the returned checkId).
     *
     * @param  array<string, mixed>  $attributes
     */
    private static function createCheckRow(CandidateRecipe $candidate, string $source, array $attributes): ?DuplicateCheck
    {
        return DuplicateCheck::query()->create([
            ...$attributes,
            // recipe_id = the candidate's recipe id when known/persisted.
            'recipe_id' => isset($candidate->meta['recipe_id']) && is_numeric($candidate->meta['recipe_id'])
                ? (int) $candidate->meta['recipe_id'] : null,
            'source' => mb_substr($source, 0, 16),
        ]);
    }

    /**
     * Decision DTO → duplicate_checks columns. The DB action vocabulary
     * is the DuplicateCheck constants (accepted|rejected_duplicate|
     * flagged_review); is_duplicate stays null while uncertain.
     *
     * @return array<string, mixed>
     */
    private static function checkRowAttributes(DuplicateDecision $decision): array
    {
        return [
            'matched_recipe_id' => $decision->matchedRecipeId,
            'batch_id' => null, // slice 5 stamps it via the returned checkId
            'layer' => $decision->layer,
            'action' => self::checkAction($decision->action),
            'is_duplicate' => $decision->action === DuplicateDecision::ACTION_NEEDS_REVIEW
                ? null
                : $decision->isDuplicate,
            'scores' => $decision->score?->toArray(),
            'classification' => $decision->classification,
            'ai_confidence' => $decision->confidence,
            'reason' => $decision->reason,
            'differences' => $decision->differences,
            'status' => $decision->action === DuplicateDecision::ACTION_NEEDS_REVIEW
                ? DuplicateCheck::STATUS_NEEDS_REVIEW
                : DuplicateCheck::STATUS_RESOLVED,
        ];
    }

    private static function checkAction(string $decisionAction): string
    {
        return match ($decisionAction) {
            DuplicateDecision::ACTION_ACCEPTED => DuplicateCheck::ACTION_ACCEPTED,
            DuplicateDecision::ACTION_DUPLICATE => DuplicateCheck::ACTION_REJECTED_DUPLICATE,
            default => DuplicateCheck::ACTION_FLAGGED_REVIEW,
        };
    }

    /**
     * Degenerate candidate = title empty OR zero ingredients OR zero
     * steps — the same rule FingerprintService uses for is_complete, so a
     * candidate whose fingerprint would be flagged degraded upward ALSO
     * gets the same caution downward.
     */
    private static function isDegenerate(CandidateRecipe $candidate): bool
    {
        return trim($candidate->title) === ''
            || ($candidate->ingredientsRaw === [] && $candidate->ingredientsStructured === [])
            || $candidate->steps === [];
    }
}
