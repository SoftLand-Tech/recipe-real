<?php

namespace App\Console\Commands;

use App\Jobs\BackfillRecipesChunk;
use App\Models\Recipe;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Starts the resumable backfill of existing recipes (slice 6 ops — see
 * docs/recipe-dedup.md and BackfillRecipesChunk for the full semantics).
 *
 *   --sync      walks the whole remaining table inline, one line per chunk —
 *               for cron/single-shot environments without a queue worker.
 *   --start-id  first recipe id to process. When a saved cursor exists the
 *               backfill RESUMES after it (the cursor is authoritative; to
 *               force a manual position clear
 *               recipe_dedup.backfill.cursor first).
 *   --chunk     recipes per chunk job (defaults to config
 *               recipe_dedup.backfill.chunk).
 *
 * Default (no --sync) behaviour dispatches ONLY the first chunk job and
 * exits: the queue chain walks the rest, and `recipereal:dedup-status`
 * reports progress. The flag `recipe_dedup.backfill.dispatch_ahead` is
 * RESERVED — chunks chain one-by-one-on-completion (never queued ahead),
 * which keeps in-flight chunks naturally at ~1.
 */
final class DedupIndexCommand extends Command
{
    protected $signature = 'recipereal:dedup-index {--start-id=1} {--chunk=} {--sync} {--force : Start even when a recent backfill chain signal exists (resume after a crash)}';

    protected $description = 'Backfill: fingerprint + index existing recipes chunk by chunk (resumable).';

    public function handle(): int
    {
        if (! (bool) config('recipe_dedup.enabled')) {
            $this->warn('recipe_dedup.enabled is false — the dedup engine is off, nothing to backfill.');

            return self::FAILURE;
        }

        // Refuse to start while a backfill chain is (recently) active: the
        // cursor is SHARED state — two interleaved chains would double
        // provider work and cross-talk the rebuild-pending flag. A worker
        // that died mid-chain also leaves a fresh flag, so explicit
        // --force is the operator's resume-after-crash override (a chain
        // older than 30 minutes unlocks without it).
        $running = Cache::get(BackfillRecipesChunk::RUNNING_KEY);
        if (! (bool) $this->option('force')
            && is_numeric($running)
            && (now()->getTimestamp() - (int) $running) <= 1800
        ) {
            $this->error(sprintf(
                'A backfill chain appears active since %s — refusing to start a second one. Check `recipereal:dedup-status`; resume the crashed chain with --force (a chain older than 30 minutes unlocks without it).',
                date('Y-m-d H:i:s', (int) $running),
            ));

            return self::FAILURE;
        }

        $chunkSize = (int) ($this->option('chunk') ?: config('recipe_dedup.backfill.chunk', 200));
        $chunkSize = max(1, $chunkSize);

        $cursor = Cache::get(BackfillRecipesChunk::CURSOR_KEY);
        $requestedStart = max(1, (int) $this->option('start-id'));
        // Resume strictly after the saved cursor when one exists (fresh
        // fingerprint rows make re-visited recipes a no-op, so a resume is
        // always safe to re-run from an earlier position too).
        $startId = is_numeric($cursor) && (int) $cursor > 0
            ? max($requestedStart, (int) $cursor + 1)
            : $requestedStart;

        // A fresh walk (no saved cursor at all) begins: stale done/cursor
        // state from a previous run must not survive it. A --start-id
        // BEYOND an existing cursor is NOT a fresh walk — the cursor is
        // preserved so dedup-status keeps reporting true progress.
        if (! is_numeric($cursor) || (int) $cursor <= 0) {
            Cache::forget(BackfillRecipesChunk::DONE_KEY);
            Cache::forget(BackfillRecipesChunk::CURSOR_KEY);
        }

        if ((bool) $this->option('sync')) {
            return $this->runSync($startId, $chunkSize);
        }

        BackfillRecipesChunk::dispatch($startId, $chunkSize);

        $this->info(sprintf(
            'Backfill chunk #%d (size %d) dispatched to the queue — each job chains the next when it finishes.',
            $startId,
            $chunkSize,
        ));
        $this->line('Watch progress with: php artisan recipereal:dedup-status');

        return self::SUCCESS;
    }

    private function runSync(int $startId, int $chunkSize): int
    {
        $chunks = 0;
        $totals = ['processed' => 0, 'registered' => 0, 'skipped' => 0, 'collisions' => 0, 'embedding_failed' => 0, 'failed' => 0];

        while ((bool) Recipe::query()->where('id', '>=', $startId)->exists()) {
            $chunk = new BackfillRecipesChunk($startId, $chunkSize);
            // Inline processing: this loop replaces the queue chain, so the
            // chunk must not also enqueue its successor.
            $chunk->chain = false;

            /** @var array<string, int|null> $summary */
            $summary = app()->call([$chunk, 'handle']);
            $chunks++;

            $this->info($this->chunkLine($chunk, $summary));

            foreach ($totals as $key => $total) {
                $totals[$key] = $total + (int) ($summary[$key] ?? 0);
            }

            if ($summary['last_id'] === null) {
                break;
            }

            $startId = (int) $summary['last_id'] + 1;
        }

        if ($chunks === 0) {
            Cache::forget(BackfillRecipesChunk::RUNNING_KEY);
            Cache::forever(BackfillRecipesChunk::DONE_KEY, true);
        }

        Log::info(sprintf(
            '[recipe-dedup backfill] sync walk finished: chunks=%d processed=%d registered=%d skipped=%d collisions=%d embedding_failed=%d failed=%d',
            $chunks,
            $totals['processed'],
            $totals['registered'],
            $totals['skipped'],
            $totals['collisions'],
            $totals['embedding_failed'],
            $totals['failed'],
        ));

        $this->info(sprintf(
            'Sync backfill finished: %d chunk(s), %d processed (%d registered, %d already fresh, %d collisions, %d failed).',
            $chunks,
            $totals['processed'],
            $totals['registered'],
            $totals['skipped'],
            $totals['collisions'],
            $totals['failed'],
        ));

        return self::SUCCESS;
    }

    /**
     * The per-chunk console line (twin of the job's Log::info line).
     *
     * @param  array<string, int|null>  $summary
     */
    private function chunkLine(BackfillRecipesChunk $chunk, array $summary): string
    {
        return sprintf(
            'chunk #%d..%s processed=%d skipped=%d registered=%d collisions=%d embedding_failed=%d failed=%d',
            $chunk->startId,
            isset($summary['last_id']) && $summary['last_id'] !== null
                ? (int) $summary['last_id']
                : (string) ($chunk->startId + $chunk->chunkSize - 1),
            $summary['processed'] ?? 0,
            $summary['skipped'] ?? 0,
            $summary['registered'] ?? 0,
            $summary['collisions'] ?? 0,
            $summary['embedding_failed'] ?? 0,
            $summary['failed'] ?? 0,
        );
    }
}
