<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Backfills the Reality Index columns on recipes (reality_minutes /
 * reality_source / reality_samples — see Recipe::recalculateReality() for
 * the live-maintenance twin of this rule):
 *
 *  - community_avg_minutes set  → reality = that average, source
 *    'community', samples = the recipe's cook sessions with a non-null
 *    total_actual_minutes.
 *  - else, SUM(ai_minutes) over the recipe's NON-cleanup steps > 0 →
 *    reality = that sum, source 'estimate', samples 0.
 *  - else → reality stays/becomes null (no honest signal yet).
 *
 * Runs as id-cursor chunked SELECTs (cook-session counts and step sums are
 * fetched per chunk with grouped IN queries, not per row) + batched
 * per-chunk UPDATEs. Idempotent: rows whose computed values equal the
 * stored ones are not touched, so re-runs converge and are cheap.
 */
class BackfillReality extends Command
{
    protected $signature = 'recipereal:backfill-reality';

    protected $description = 'Backfill recipes.reality_* (community avg, else AI step-time estimate).';

    private const CHUNK = 500;

    private const PROGRESS_EVERY = 10000;

    public function handle(): int
    {
        // Long write transactions + other writers = sqlite "database is
        // locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info('Backfilling reality columns...');

        $now = Carbon::now()->format('Y-m-d H:i:s');
        $scanned = $written = 0;
        $community = $estimate = $null = 0;
        $lastId = 0;

        // Id-cursor loop (WHERE id > lastId), NOT offset pagination —
        // OFFSET re-scans the whole head of the table at 520k rows.
        while (true) {
            $rows = DB::table('recipes')
                ->where('id', '>', $lastId)
                ->orderBy('id')
                ->limit(self::CHUNK)
                ->get(['id', 'community_avg_minutes', 'reality_minutes', 'reality_source', 'reality_samples']);

            if ($rows->isEmpty()) {
                break;
            }
            $lastId = (int) $rows->last()->id;

            $ids = $rows->pluck('id')->all();

            // Per-chunk grouped aggregates instead of per-row queries.
            $sessionCounts = DB::table('cook_sessions')
                ->whereIn('recipe_id', $ids)
                ->whereNotNull('total_actual_minutes')
                ->groupBy('recipe_id')
                ->selectRaw('recipe_id, COUNT(*) AS n')
                ->pluck('n', 'recipe_id');

            $stepSums = DB::table('recipe_steps')
                ->whereIn('recipe_id', $ids)
                ->where('step_type', '!=', 'cleanup')
                ->whereNotNull('ai_minutes')
                ->groupBy('recipe_id')
                ->selectRaw('recipe_id, SUM(ai_minutes) AS s')
                ->pluck('s', 'recipe_id');

            $updates = [];
            foreach ($rows as $row) {
                if ($row->community_avg_minutes !== null) {
                    $target = [
                        'reality_minutes' => round((float) $row->community_avg_minutes, 2),
                        'reality_source' => 'community',
                        'reality_samples' => (int) ($sessionCounts[$row->id] ?? 0),
                    ];
                    $community++;
                } else {
                    $sum = round((float) ($stepSums[$row->id] ?? 0), 2);
                    if ($sum > 0) {
                        $target = [
                            'reality_minutes' => $sum,
                            'reality_source' => 'estimate',
                            'reality_samples' => 0,
                        ];
                        $estimate++;
                    } else {
                        // No honest signal: converge to null (idempotent).
                        $target = [
                            'reality_minutes' => null,
                            'reality_source' => null,
                            'reality_samples' => 0,
                        ];
                        $null++;
                    }
                }

                // Skip rows already holding the computed values — makes
                // re-runs (and the overwhelmingly null first run) cheap.
                // reality_minutes is compared null-aware (a loose (float)
                // cast would turn null into 0.0 and rewrite every null row).
                $current = [
                    'reality_minutes' => $row->reality_minutes !== null ? round((float) $row->reality_minutes, 2) : null,
                    'reality_source' => $row->reality_source,
                    'reality_samples' => (int) $row->reality_samples,
                ];
                if ($current === $target) {
                    continue;
                }

                $updates[$row->id] = $target + ['updated_at' => $now];
            }

            if ($updates !== []) {
                DB::transaction(function () use ($updates): void {
                    foreach ($updates as $id => $fields) {
                        DB::table('recipes')->where('id', $id)->update($fields);
                    }
                });
                $written += count($updates);
            }

            $scanned += $rows->count();
            if ($scanned % self::PROGRESS_EVERY < self::CHUNK) {
                $this->info(sprintf('  %s scanned, %s written...', number_format($scanned), number_format($written)));
            }
        }

        $this->info(sprintf(
            'Done: %s recipes scanned, %s written. Reality source: %s community, %s estimate, %s null.',
            number_format($scanned),
            number_format($written),
            number_format($community),
            number_format($estimate),
            number_format($null),
        ));

        return self::SUCCESS;
    }
}
