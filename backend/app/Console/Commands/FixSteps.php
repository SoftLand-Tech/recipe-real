<?php

namespace App\Console\Commands;

use App\Support\RVector;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Repairs recipes imported with a single giant "step" that is actually the
 * raw, un-parsed R-style instruction vector (text starting `c("Heat oven to
 * 350°F.", "Grease...`). ImportFoodcom's original parser (str_getcsv) broke
 * on rows containing escaped quotes (`\"` / `""`), so the whole c(...) blob
 * was stored as ONE step — in recipe_steps AND the recipes.steps JSON.
 *
 * One id-cursor pass over recipes (chunks of 500, their steps fetched per
 * chunk), DB::table only (no model events), one transaction per chunk:
 *
 *   1. A recipe whose step rows (or steps JSON) contain a c(...) blob is
 *      re-parsed with the hardened App\Support\RVector splitter, then the
 *      same degenerate filter as the importer is applied (strlen >= 5 and
 *      has a letter):
 *        - >= 2 clean steps  → recipe_steps rows replaced (renumbered from
 *          1) and the steps JSON rebuilt from them;
 *        - 1 clean step      → the row text is just cleaned (quotes etc.);
 *        - 1 step still > 600 chars → sentence-split on `.!?` boundaries;
 *          if that still yields a single step the recipe is left as-is —
 *          Recipe::scopeListable (steps_count >= 2) keeps it out of the app.
 *      When the rows are clean but only the JSON copy holds the blob, the
 *      JSON is rebuilt from the rows (rows win).
 *   2. steps_count is recomputed for EVERY scanned recipe (this command is
 *      the migration backfill); only changed values are written.
 *
 * Re-inserted steps get step_type 'active' — run recipereal:classify-steps
 * afterwards to re-classify passive/cleanup steps.
 *
 * --dry-run runs the identical scan and reports what would change, without
 * writing anything.
 */
class FixSteps extends Command
{
    protected $signature = 'recipereal:fix-steps {--dry-run : Scan and report, do not write}';

    protected $description = 'Re-split raw R-vector recipe steps and backfill recipes.steps_count.';

    private const CHUNK = 500;

    private const PROGRESS_EVERY = 25000;

    /** Step descriptions that are an un-parsed R vector: c("a", "b", ...). */
    private const RAW_VECTOR_REGEX = '/^\s*c\(/i';

    /** A re-parsed single step longer than this is sentence-split. */
    private const SENTENCE_SPLIT_MIN = 600;

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        // Long write transactions + other writers (queue worker) = sqlite
        // "database is locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info(($dryRun ? 'Dry run: scanning' : 'Fixing').' recipe steps...');

        $now = Carbon::now()->format('Y-m-d H:i:s');
        $scanned = 0;
        $fixed = 0;         // re-parsed into >= 2 steps
        $cleaned = 0;       // re-parsed into a single cleaned step
        $sentenceSplit = 0; // single >600-char step split on sentence ends
        $jsonRebuilt = 0;   // steps JSON rebuilt from already-clean rows
        $leftBroken = 0;    // un-recoverable: left as-is, hidden by listing rule
        $countUpdates = 0;
        $dist = ['0' => 0, '1' => 0, '2-5' => 0, '6-10' => 0, '11+' => 0];

        $lastId = 0;
        while (true) {
            $recipes = DB::table('recipes')
                ->where('id', '>', $lastId)
                ->orderBy('id')
                ->limit(self::CHUNK)
                ->get(['id', 'steps', 'steps_count']);

            if ($recipes->isEmpty()) {
                break;
            }
            $lastId = $recipes->last()->id;

            $stepsByRecipe = DB::table('recipe_steps')
                ->whereIn('recipe_id', $recipes->pluck('id'))
                ->orderBy('recipe_id')
                ->orderBy('step_number')
                ->get(['recipe_id', 'description'])
                ->groupBy('recipe_id');

            $rowFixes = [];   // recipe_id => list<string> new steps (rows + JSON replaced)
            $jsonFixes = [];  // recipe_id => list<string> steps from rows (JSON-only repair)
            $countFixes = []; // recipe_id => int

            foreach ($recipes as $recipe) {
                $rows = $stepsByRecipe->get($recipe->id) ?? collect();

                $rawDescriptions = [];
                foreach ($rows as $row) {
                    if (preg_match(self::RAW_VECTOR_REGEX, (string) $row->description) === 1) {
                        $rawDescriptions[] = (string) $row->description;
                    }
                }

                $newSteps = null;
                if ($rawDescriptions !== []) {
                    $parsed = [];
                    foreach ($rawDescriptions as $raw) {
                        $parsed = array_merge($parsed, RVector::parse($raw));
                    }
                    $parsed = $this->filterDegenerate($parsed);

                    if (count($parsed) >= 2) {
                        $fixed++;
                        $newSteps = $parsed;
                    } elseif (count($parsed) === 1) {
                        if (strlen($parsed[0]) > self::SENTENCE_SPLIT_MIN) {
                            $sentences = $this->filterDegenerate(
                                preg_split('/(?<=[.!?])\s+/', $parsed[0]) ?: []
                            );
                            if (count($sentences) >= 2) {
                                $sentenceSplit++;
                                $newSteps = $sentences;
                            } else {
                                $leftBroken++;
                            }
                        } else {
                            $cleaned++;
                            $newSteps = $parsed;
                        }
                    } else {
                        $leftBroken++;
                    }
                } elseif ($this->jsonHasRawVector((string) $recipe->steps)) {
                    // Rows are clean but the JSON copy still holds the raw
                    // vector: rebuild the JSON from the rows (rows win).
                    $jsonRebuilt++;
                    $jsonFixes[$recipe->id] = $rows->pluck('description')->all();
                }

                if ($newSteps !== null) {
                    $rowFixes[$recipe->id] = $newSteps;
                    $count = count($newSteps);
                } else {
                    $count = $rows->count();
                }

                if ($count !== (int) $recipe->steps_count) {
                    $countFixes[$recipe->id] = $count;
                }
                $dist[$this->bucket($count)]++;
            }

            if (! $dryRun && ($rowFixes !== [] || $jsonFixes !== [] || $countFixes !== [])) {
                DB::transaction(function () use ($rowFixes, $jsonFixes, $countFixes, $now): void {
                    foreach ($rowFixes as $recipeId => $descriptions) {
                        DB::table('recipe_steps')->where('recipe_id', $recipeId)->delete();

                        $stepRows = [];
                        foreach (array_values($descriptions) as $i => $description) {
                            $stepRows[] = [
                                'recipe_id' => $recipeId,
                                'step_number' => $i + 1,
                                'description' => $description,
                                'step_type' => 'active',
                                'publisher_minutes' => null,
                                'community_avg_minutes' => null,
                                'created_at' => $now,
                                'updated_at' => $now,
                            ];
                        }
                        foreach (array_chunk($stepRows, 1000) as $chunk) {
                            DB::table('recipe_steps')->insert($chunk);
                        }

                        DB::table('recipes')->where('id', $recipeId)->update([
                            'steps' => json_encode(array_values($descriptions)),
                            'steps_count' => count($descriptions),
                            'updated_at' => $now,
                        ]);
                        unset($countFixes[$recipeId]); // already written above
                    }

                    foreach ($jsonFixes as $recipeId => $descriptions) {
                        DB::table('recipes')->where('id', $recipeId)->update([
                            'steps' => json_encode(array_values($descriptions)),
                            'steps_count' => count($descriptions),
                            'updated_at' => $now,
                        ]);
                        unset($countFixes[$recipeId]);
                    }

                    foreach ($countFixes as $recipeId => $count) {
                        DB::table('recipes')->where('id', $recipeId)->update(['steps_count' => $count]);
                    }
                });
            }
            $countUpdates += count($countFixes);

            $scanned += $recipes->count();
            if ($scanned % self::PROGRESS_EVERY < self::CHUNK) {
                $this->info(sprintf(
                    '  %s scanned, %s fixed, %s split, %s counts updated...',
                    number_format($scanned),
                    number_format($fixed + $cleaned),
                    number_format($sentenceSplit),
                    number_format($countUpdates)
                ));
            }
        }

        $hidden = $dist['0'] + $dist['1'];
        $this->info(sprintf(
            '%s: %s recipes scanned | vector re-parsed: %s | single-step cleaned: %s | sentence-split: %s | JSON rebuilt: %s | left broken (hidden): %s | steps_count updated: %s.',
            $dryRun ? 'Dry run complete' : 'Done',
            number_format($scanned),
            number_format($fixed),
            number_format($cleaned),
            number_format($sentenceSplit),
            number_format($jsonRebuilt),
            number_format($leftBroken),
            number_format($countUpdates)
        ));
        $this->info(sprintf(
            'steps_count distribution: 0 steps: %s | 1 step: %s | 2-5: %s | 6-10: %s | 11+: %s | hidden from listings (< 2): %s',
            number_format($dist['0']),
            number_format($dist['1']),
            number_format($dist['2-5']),
            number_format($dist['6-10']),
            number_format($dist['11+']),
            number_format($hidden)
        ));

        return self::SUCCESS;
    }

    /**
     * Does the recipes.steps JSON still carry an un-parsed vector element?
     */
    private function jsonHasRawVector(?string $stepsJson): bool
    {
        if ($stepsJson === null || trim($stepsJson) === '') {
            return false;
        }

        $decoded = json_decode($stepsJson, true);
        if (! is_array($decoded)) {
            return false;
        }

        foreach ($decoded as $step) {
            if (is_string($step) && preg_match(self::RAW_VECTOR_REGEX, $step) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * The importer's degenerate-step filter: drop bare numbers / single
     * characters / punctuation-only leftovers.
     *
     * @param  list<string>  $steps
     * @return list<string>
     */
    private function filterDegenerate(array $steps): array
    {
        return array_values(array_filter(
            $steps,
            fn ($s) => is_string($s) && strlen($s) >= 5 && preg_match('/[a-z]/i', $s) === 1
        ));
    }

    private function bucket(int $count): string
    {
        return $count >= 11 ? '11+' : ($count >= 6 ? '6-10' : ($count >= 2 ? '2-5' : (string) $count));
    }
}
