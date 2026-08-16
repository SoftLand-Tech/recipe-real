<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Classifies imported recipe_steps (all step_type 'active') into
 * passive / cleanup by matching the step description against keyword
 * regexes:
 *
 *   passive — hands-off waiting: simmer, bake, roast, rest, marinate,
 *             chill/refrigerate/freeze, soak, steep, prove, rise, cool,
 *             overnight, "set aside", "let it rest", "reduce heat", ...
 *   cleanup — washing up: wash, "clean up/the", wipe, "discard fat", ...
 *
 * "preheat" is explicitly NOT passive and "serve" is NOT cleanup — neither
 * matches any pattern, so they stay active. Everything unmatched stays
 * active.
 *
 * Runs as id-cursor chunked SELECTs + batch UPDATEs (no model events) so it
 * scales to the ~3.2M-step production table. Re-runnable: only 'active'
 * rows are scanned, and within those only rows whose computed type differs
 * are touched.
 */
class ClassifySteps extends Command
{
    protected $signature = 'recipereal:classify-steps
        {--limit= : Max steps to scan}';

    protected $description = 'Classify active recipe_steps into passive/cleanup via keyword matching.';

    private const CHUNK = 1000;

    private const PROGRESS_EVERY = 25000;

    /**
     * Hands-off / waiting steps. Boundaries matter: \b...\b keeps "rest"
     * out of "restaurant", "stand" out of "understand", "sit" out of
     * "site". "preheat" contains none of these tokens and stays active.
     */
    private const PASSIVE_REGEX =
        '/\b(?:simmer(?:s|ed|ing)?|bak(?:e|es|ed|ing)|roast(?:s|ed|ing)?|rest(?:s|ed|ing)?|marinat(?:e|es|ed|ing)|chill(?:s|ed|ing)?|refrigerat(?:e|es|ed|ing)|freez(?:e|es|ed|ing)|soak(?:s|ed|ing)?|steep(?:s|ed|ing)?|prov(?:e|es|ed|ing)|rise(?:s|n)?|stand(?:s|ing)?|sits?|sitting|cool(?:s|ed|ing)?|overnight)\b'
        .'|boil\b.{0,40}\blow\b'
        .'|set\s+aside'
        .'|let\s+(?:it\s+|them\s+)?(?:rest|sit|stand|cool)'
        .'|reduc\w*\b.{0,60}\bheat'
        .'|low\s+heat'
        .'|unattended'
        .'|meanwhile\b.{0,80}\b(?:simmer|bak(?:e|ing))'
        .'|allow\w*\b.{0,60}\b(?:rest|cool)'
        .'/i';

    /** Washing-up steps. "serve" matches none of these and stays active. */
    private const CLEANUP_REGEX =
        '/\bwash(?:es|ed|ing)?'
        .'|\bclean\s+(?:up|the)'
        .'|rinse\w*\b.{0,80}\bdishes\b'
        .'|\bwip(?:e|es|ed|ing)'
        .'|discard\w*\b.{0,80}\b(?:fat|grease)'
        .'|drain\w*\b.{0,80}\bfat\b'
        .'/i';

    public function handle(): int
    {
        $limit = (int) ($this->option('limit') ?: 0);

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info('Classifying steps...'.($limit > 0 ? " (scanning at most {$limit})" : ''));

        $now = Carbon::now()->format('Y-m-d H:i:s');
        $scanned = $passive = $cleanup = 0;
        $lastId = 0;

        // Id-cursor loop (WHERE id > lastId), NOT offset pagination —
        // OFFSET re-scans the whole head of the table at 3.2M rows.
        while (true) {
            if ($limit > 0 && $scanned >= $limit) {
                break;
            }

            $take = $limit > 0 ? min(self::CHUNK, $limit - $scanned) : self::CHUNK;
            $rows = DB::table('recipe_steps')
                ->where('step_type', 'active')
                ->where('id', '>', $lastId)
                ->orderBy('id')
                ->limit($take)
                ->get(['id', 'description']);

            if ($rows->isEmpty()) {
                break;
            }
            $lastId = $rows->last()->id;

            $passiveIds = [];
            $cleanupIds = [];
            foreach ($rows as $row) {
                // Only rows whose computed type differs from the current
                // ('active') one are collected for update.
                if (preg_match(self::PASSIVE_REGEX, (string) $row->description) === 1) {
                    $passiveIds[] = $row->id;
                } elseif (preg_match(self::CLEANUP_REGEX, (string) $row->description) === 1) {
                    $cleanupIds[] = $row->id;
                }
            }

            if ($passiveIds !== [] || $cleanupIds !== []) {
                DB::transaction(function () use ($passiveIds, $cleanupIds, $now): void {
                    foreach (array_chunk($passiveIds, 500) as $chunk) {
                        DB::table('recipe_steps')->whereIn('id', $chunk)
                            ->update(['step_type' => 'passive', 'updated_at' => $now]);
                    }
                    foreach (array_chunk($cleanupIds, 500) as $chunk) {
                        DB::table('recipe_steps')->whereIn('id', $chunk)
                            ->update(['step_type' => 'cleanup', 'updated_at' => $now]);
                    }
                });
            }
            $passive += count($passiveIds);
            $cleanup += count($cleanupIds);

            $scanned += $rows->count();
            if ($scanned % self::PROGRESS_EVERY < self::CHUNK) {
                $this->info(sprintf('  %s scanned, %s passive, %s cleanup...', number_format($scanned), number_format($passive), number_format($cleanup)));
            }
        }

        $this->info(sprintf('Done: %s steps scanned, %s → passive, %s → cleanup, rest stay active.', number_format($scanned), number_format($passive), number_format($cleanup)));

        return self::SUCCESS;
    }
}
