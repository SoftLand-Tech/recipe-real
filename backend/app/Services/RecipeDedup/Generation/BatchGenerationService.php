<?php

namespace App\Services\RecipeDedup\Generation;

use App\Models\RecipeGenerationBatch;
use App\Models\RecipeGenerationBatchItem;
use App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\DuplicateDecision;
use App\Services\RecipeDedup\Data\GenerationRequest;
use App\Services\RecipeDedup\Detection\DuplicateDetectionService;
use App\Services\RecipeDedup\Detection\RecipeRegistrar;
use App\Services\RecipeDedup\GenerationException;
use App\Support\HalalGate;
use Throwable;

/**
 * Bounded replacement loop that drives ONE batch to its target of ACCEPTED
 * recipes: generate -> halal-gate -> dedup-evaluate + register -> record —
 * and repeat under hard attempt/wall caps with a single-worker lease.
 *
 * Re-entrancy and crash-resume: run() re-reads the batch row, claims its
 * lease (expires -> claimable again) and CONTINUES from the DB itself:
 * accepted/rejected/failed counters, generation_attempts and the
 * avoid-titles list all live in the recipe_generation_batches /
 * _batch_items rows, never in memory. A crashed worker's lease expires and
 * the next run() picks the batch up where it stopped.
 */
final class BatchGenerationService
{
    /** Maximum avoid-titles carried in one prompt (prompt-size guard). */
    private const AVOID_TITLES_CAP = 100;

    public function __construct(
        private readonly RecipeCandidateGenerator $generator,
        // The detection engine, injected alongside the registrar (locked
        // construction contract of this service): decisions/consumers in
        // the flow go through registrar->register(), which owns evaluate();
        // the service keeps the dependency so operators can decorate/opt
        // out of detection in one place.
        private readonly DuplicateDetectionService $detection,
        private readonly RecipeRegistrar $registrar,
    ) {}

    /**
     * Drive a batch until its target is accepted or a cap is hit.
     *
     * @param  RecipeGenerationBatch|int  $batch  batch row or its id
     * @param  int|null  $targetOverride  temporary accepted-target override
     *                                    for THIS run (ops knob); caps math
     *                                    uses it like a requested count and
     *                                    the computed cap persists on the row
     * @return RecipeGenerationBatch the fresh row (completed|exhausted|failed
     *                               — returned as-is when already terminal)
     *
     * @throws GenerationException when another worker still holds the lease
     * @throws Throwable unexpected failures are recorded on the row, then
     *                   rethrown after the lease release
     */
    public function run(RecipeGenerationBatch|int $batch, ?int $targetOverride = null): RecipeGenerationBatch
    {
        // Always continue from the best-known DB state (idempotent re-runs,
        // resume after crash): counters are persisted, never trusted from a
        // possibly-stale caller instance.
        $batch = $batch instanceof RecipeGenerationBatch
            ? RecipeGenerationBatch::query()->findOrFail($batch->id)
            : RecipeGenerationBatch::query()->findOrFail($batch);

        if ($batch->isTerminal()) {
            // Idempotent: completed/exhausted/failed/cancelled batches are
            // never re-run — create a new batch instead.
            return $batch;
        }

        $settings = $this->settings($batch);
        $target = max(1, $targetOverride ?? (int) $batch->requested_count);

        // Single-worker lease. When this call cannot win the claim another
        // worker owns the batch — refusing to touch its lease is deliberate
        // (stealing it would let two workers drive one batch).
        if (! $batch->claimLease($settings['lease_seconds'])) {
            throw new GenerationException('batch already claimed or terminal');
        }

        // Attempt CAP (a cap of ONE generator call): ceil(target * multiplier
        // / batch_size). Computed once when 0 and PERSISTED, so resumes use
        // the same numbers as the original run. With multiplier 3 and
        // batch_size 10: target 100 -> <= 30 generator calls.
        if ((int) $batch->max_attempts === 0) {
            $batch->forceFill([
                'max_attempts' => (int) ceil($target * $settings['max_attempt_multiplier'] / $settings['batch_size']),
            ])->save();
        }

        // Titles already attempted in previous (possibly crashed) runs
        // resume from the item rows; this run appends more below.
        $avoidTitles = $this->avoidTitlesFromDb($batch);

        // Recipe attribution (spec: generation picks the owner, the
        // registrar persists it): the creating command stows the resolved
        // owner id in params; without one the recipes get owner_id null,
        // exactly like imports.
        $params = is_array($batch->params) ? $batch->params : [];
        $ownerId = is_numeric($params['owner_id'] ?? null) ? (int) $params['owner_id'] : null;

        $wallDeadline = microtime(true) + max(1, $settings['max_wall_seconds']);

        try {
            while (true) {
                $batch->refresh();

                // remaining = effective target (override-aware) - accepted
                if (max(0, $target - (int) $batch->accepted_count) <= 0) {
                    $this->finish($batch, RecipeGenerationBatch::STATUS_COMPLETED);

                    break;
                }

                if ($batch->generation_attempts >= (int) $batch->max_attempts) {
                    $this->exhaust($batch, 'attempt cap reached');

                    break;
                }

                if (microtime(true) >= $wallDeadline) {
                    $this->exhaust($batch, 'wall-clock cap reached');

                    break;
                }

                // Lease renewal is best-effort: while OUR fresh lease holds,
                // claimLease() simply loses (it only wins expired rows) and
                // an unexpired lease means keep going. It fails for real
                // only when we demonstrably lost the batch: lease expired
                // (or released) and not re-claimable within this loop tick.
                if (! $batch->claimLease($settings['lease_seconds'])
                    && $this->leaseLost($batch)
                ) {
                    $this->exhaust($batch, 'lease lost to another worker');

                    break;
                }

                $this->driveOneIteration($batch, $target, $settings, $avoidTitles, $ownerId);
            }
        } catch (Throwable $e) {
            // Unexpected failure (DB outage, registrar explosion, ...):
            // record it, release the lease (finally) and surface the error.
            $batch->forceFill([
                'status' => RecipeGenerationBatch::STATUS_FAILED,
                'error' => mb_substr($e->getMessage(), 0, 2000),
            ])->save();

            throw $e;
        } finally {
            $batch->releaseLease();
        }

        return $batch->refresh();
    }

    /**
     * ONE generator call + all its candidates.
     *
     * Over-generation (`count = min(batch_size, 2 * remaining)`): the
     * loop over-ASKS by 2x the remaining target so a single call can eat
     * rejection churn (dupes/reviews/failures) and still satisfy the
     * target — the brief's "remainingTarget + 1 oversized" minimum is
     * subsumed by this margin; strict-target calls (1x) would exhaust
     * their caps twice as fast on dupe-heavy briefs.
     *
     * @param  list<string>  $avoidTitles  mutated: titles tried this call
     *                                     are appended (cap 100)
     */
    private function driveOneIteration(
        RecipeGenerationBatch $batch,
        int $target,
        array $settings,
        array &$avoidTitles,
        ?int $ownerId,
    ): void {
        $remaining = max(0, $target - (int) $batch->accepted_count);
        $params = is_array($batch->params) ? $batch->params : [];

        $request = new GenerationRequest(
            brief: $this->briefFor($batch),
            count: min($settings['batch_size'], max(1, 2 * $remaining)),
            cuisine: $batch->cuisine,
            dishFamily: $batch->dish_family,
            category: $batch->category,
            avoidTitles: $avoidTitles,
            language: (string) ($params['language'] ?? 'en'),
            // Zero-based call index; carried across resumes via the DB.
            iteration: (int) $batch->generation_attempts,
            // $ownerId resolved below is the registrar's attribution source;
            // the echo in meta keeps per-call records self-describing.
            meta: array_filter([
                'batch_id' => (int) $batch->id,
                'target' => $target,
                'owner_id' => $ownerId,
            ], fn ($value): bool => $value !== null),
        );

        // Count + persist the attempt BEFORE the generator call: a worker
        // crash mid-call burns exactly one attempt for the next runner too.
        $batch->forceFill(['generation_attempts' => (int) $batch->generation_attempts + 1])->save();

        try {
            $candidates = $this->generator->generate($request);
        } catch (GenerationException $e) {
            // A failed CALL (not per candidate): logged, NOT fatal — the
            // loop replaces the attempt until the caps say stop.
            $batch->forceFill(['failed_count' => (int) $batch->failed_count + 1])->save();
            $this->item($batch, [
                'action' => RecipeGenerationBatchItem::ACTION_GENERATION_FAILED,
                'reason' => mb_substr($e->getMessage(), 0, 500),
            ]);

            return;
        }

        foreach ($candidates as $candidate) {
            $avoidTitles[] = $candidate->title;
            $avoidTitles = array_slice(array_values(array_unique($avoidTitles)), -self::AVOID_TITLES_CAP);

            if (trim($candidate->title) === '') {
                // Content failure (no dedup decision involved yet).
                $batch->forceFill(['failed_count' => (int) $batch->failed_count + 1])->save();
                $this->item($batch, [
                    'action' => RecipeGenerationBatchItem::ACTION_GENERATION_FAILED,
                    'title' => null,
                    'reason' => 'empty_title',
                    'candidate_summary' => $this->summary($candidate),
                ]);

                continue;
            }

            $terms = HalalGate::scan([
                $candidate->title,
                $candidate->description,
                implode("\n", $candidate->ingredientsRaw),
                implode("\n", $candidate->steps),
            ]);

            if ($terms !== []) {
                // Halal rejects are CONTENT failures, not duplicates: no
                // duplicate_checks row, no registrar call, no acceptance.
                $batch->forceFill(['failed_count' => (int) $batch->failed_count + 1])->save();
                $this->item($batch, [
                    'action' => RecipeGenerationBatchItem::ACTION_GENERATION_FAILED,
                    'title' => $candidate->title,
                    'reason' => 'halal_content: '.implode(', ', $terms),
                    'candidate_summary' => $this->summary($candidate),
                ]);

                continue;
            }

            $this->registerCandidate($batch, $candidate, $ownerId);
        }
    }

    /**
     * Dedup-evaluate + register one passed candidate and log the outcome.
     *
     * In-batch duplicate prevention invariant: accepted candidates are
     * INSERTED immediately by the registrar (recipe + fingerprint/index),
     * so the NEXT candidate's evaluate() already sees them through the
     * regular DB-backed fingerprint/identity lookups — no in-memory batch
     * index exists or is needed here.
     */
    private function registerCandidate(RecipeGenerationBatch $batch, CandidateRecipe $candidate, ?int $ownerId): void
    {
        $result = $this->registrar->register($candidate, $batch, $ownerId);
        $decision = $result->decision;

        if ($decision->accepted()) {
            // Frozen registrar contract: accepted -> the recipe row exists.
            $recipe = $result->recipe ?? throw new \RuntimeException(
                'RecipeRegistrar returned an accepted decision without a recipe row.'
            );
            $batch->forceFill(['accepted_count' => (int) $batch->accepted_count + 1])->save();
            $this->item($batch, [
                'action' => RecipeGenerationBatchItem::ACTION_ACCEPTED,
                'recipe_id' => $recipe->id,
                'check_id' => $decision->checkId,
                'title' => $candidate->title,
                'layer' => $this->layerName($decision->layer),
                'score' => $decision->score?->total,
                'reason' => $decision->reason,
                'candidate_summary' => $this->summary($candidate),
            ]);

            return;
        }

        $needsReview = $decision->action === DuplicateDecision::ACTION_NEEDS_REVIEW;

        // Conservative: needs_review candidates are NOT auto-accepted during
        // generation (the review UI owns them); they reject the batch target
        // exactly like duplicates so the loop keeps hunting replacements.
        $batch->forceFill(['rejected_count' => (int) $batch->rejected_count + 1])->save();
        $this->item($batch, [
            'action' => $needsReview
                ? RecipeGenerationBatchItem::ACTION_NEEDS_REVIEW
                : RecipeGenerationBatchItem::ACTION_DUPLICATE,
            'check_id' => $decision->checkId,
            'title' => $candidate->title,
            'matched_recipe_id' => $decision->matchedRecipeId,
            'layer' => $this->layerName($decision->layer),
            'score' => $decision->score?->total,
            'reason' => $needsReview && filled($decision->reason) === false
                ? 'flagged for review'
                : $decision->reason,
            'candidate_summary' => $this->summary($candidate),
        ]);
    }

    /**
     * Per-call brief: the batch's params JSON brief, else a generic brief
     * that still carries the cuisine/category context.
     */
    private function briefFor(RecipeGenerationBatch $batch): string
    {
        $params = is_array($batch->params) ? $batch->params : [];
        $brief = is_string($params['brief'] ?? null) ? trim((string) $params['brief']) : '';

        if ($brief !== '') {
            return $brief;
        }

        $brief = 'generate new recipes';
        if ($batch->cuisine !== null && $batch->cuisine !== '') {
            $brief .= ' for '.$batch->cuisine.' cuisine';
        }
        if ($batch->category !== null && $batch->category !== '') {
            $brief .= ' in the '.$batch->category.' category';
        }

        return $brief;
    }

    /** Resolved run settings (batch row overrides > config defaults). */
    private function settings(RecipeGenerationBatch $batch): array
    {
        $config = (array) config('recipe_dedup.generation');
        $params = is_array($batch->params) ? $batch->params : [];

        return [
            'batch_size' => max(1, (int) ($params['batch_size'] ?? $config['batch_size'] ?? 10)),
            'max_attempt_multiplier' => max(1.0, (float) ($params['max_attempt_multiplier'] ?? $config['default_max_attempt_multiplier'] ?? 3)),
            'max_wall_seconds' => max(1, (int) ($config['max_wall_seconds'] ?? 3600)),
            'lease_seconds' => max(1, (int) ($config['lease_seconds'] ?? 900)),
        ];
    }

    /**
     * The accumulated do-not-repeat list: titles from earlier item rows
     * (resume) plus the current run's attempts, capped at the newest 100.
     *
     * @return list<string>
     */
    private function avoidTitlesFromDb(RecipeGenerationBatch $batch): array
    {
        $titles = RecipeGenerationBatchItem::query()
            ->where('batch_id', $batch->id)
            ->whereNotNull('title')
            // Newest first (the cap must keep the RECENT attempts — the
            // generator needs to avoid what it just tried) — re-ordered
            // chronologically below to read naturally in the prompt.
            ->orderByDesc('id')
            ->limit(self::AVOID_TITLES_CAP)
            ->pluck('title')
            ->all();

        return array_values(array_map(strval(...), array_reverse($titles)));
    }

    /** True when the batch row shows NO live lease at all (we lost it). */
    private function leaseLost(RecipeGenerationBatch $batch): bool
    {
        $batch->refresh();

        return $batch->lease_expires_at === null || $batch->lease_expires_at->isPast();
    }

    private function finish(RecipeGenerationBatch $batch, string $status): void
    {
        $batch->forceFill([
            'status' => $status,
            'finished_at' => now(),
            'error' => null,
        ])->save();
    }

    /**
     * The target became unreachable inside the caps. The error doubles as
     * the ops guidance the review/ops slices will surface.
     */
    private function exhaust(RecipeGenerationBatch $batch, string $why): void
    {
        $actions = $batch->items()
            ->selectRaw('action, count(*) as aggregate')
            ->groupBy('action')
            ->pluck('aggregate', 'action');

        $batch->forceFill([
            'status' => RecipeGenerationBatch::STATUS_EXHAUSTED,
            'finished_at' => now(),
            'error' => sprintf(
                'Accepted %d of %d after %d generation calls (duplicates: %d, failed: %d, review: %d) — increase DEDUP_GENERATION_MAX_ATTEMPT_MULTIPLIER or refine the brief [%s]',
                (int) $batch->accepted_count,
                (int) $batch->requested_count,
                (int) $batch->generation_attempts,
                (int) ($actions[RecipeGenerationBatchItem::ACTION_DUPLICATE] ?? 0),
                (int) ($actions[RecipeGenerationBatchItem::ACTION_GENERATION_FAILED] ?? 0),
                (int) ($actions[RecipeGenerationBatchItem::ACTION_NEEDS_REVIEW] ?? 0),
                $why,
            ),
        ])->save();
    }

    /**
     * The display snapshot for one candidate outcome.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function item(RecipeGenerationBatch $batch, array $attributes): RecipeGenerationBatchItem
    {
        return RecipeGenerationBatchItem::create([
            'batch_id' => $batch->id,
            ...$attributes,
        ]);
    }

    private function summary(CandidateRecipe $candidate): string
    {
        return (string) json_encode($candidate->compactSummary());
    }

    /** decision->layer (int) -> the items table's compact layer label. */
    private function layerName(int $layer): string
    {
        return match ($layer) {
            0 => 'none',
            1 => 'exact',
            2 => 'structural',
            3 => 'ai',
            default => 'layer_'.$layer,
        };
    }
}
