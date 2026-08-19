<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Support\RVector;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Imports the Kaggle "Food.com - Recipes and Reviews" dataset (irkaal, 2023)
 * into the recipes / recipe_steps tables.
 *
 * Expected file: recipes.csv (~522K rows) downloaded manually from
 * https://www.kaggle.com/datasets/irkaal/foodcom-recipes-and-reviews
 *
 * Field mapping (dataset → app):
 *   Name                  → title
 *   RecipeId              → source_url (https://www.food.com/recipe/{id})
 *   Images                → image_url (first URL; falls back to null)
 *   RecipeIngredientParts + RecipeIngredientQuantities → ingredients (json)
 *   RecipeInstructions / InstructionsList → steps (json) + recipe_steps rows
 *   TotalTime (else PrepTime+CookTime)     → publisher_time_minutes
 *
 * community_avg_minutes / cleanup_avg_minutes stay null — they are meant to
 * fill in from real timing submissions. Imported recipe_steps get step_type
 * 'active' and null minutes for the same reason.
 *
 * The dataset stores lists as R-style vectors: c("a", "b") — parsed by
 * App\Support\RVector (hardened against the escaped-quote rows the original
 * str_getcsv-based parser missed).
 */
class ImportFoodcom extends Command
{
    protected $signature = 'recipereal:import-foodcom
        {file : Path to recipes.csv}
        {--limit= : Import at most N recipes, chosen as the highest-rated N (two-pass scan)}
        {--min-rating= : Skip recipes with AggregatedRating below this (e.g. 4.5)}
        {--max-time= : Skip recipes whose total time exceeds this many minutes}
        {--ids-file= : Path to a text file of RecipeIds (one per line). Import ONLY those rows, inserting with the explicit id = RecipeId (matches the batch-pipeline id space used by recipereal:ai-apply)}
        {--fresh : Delete previously imported Food.com recipes first}';

    protected $description = 'Import recipes from the Kaggle Food.com (irkaal) CSV dataset.';

    private const SOURCE_PREFIX = 'https://www.food.com/recipe/';
    private const BATCH = 500;

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        if (! is_file($file)) {
            $this->error("File not found: {$file}");

            return self::FAILURE;
        }

        $limit = (int) ($this->option('limit') ?: 0);
        $minRating = (float) ($this->option('min-rating') ?: 0);
        $maxTime = (int) ($this->option('max-time') ?: 0);

        // --ids-file: exact-id import mode. The production recipes table was
        // seeded with explicit id = RecipeId (the same id space the AI batch
        // outputs key on), so targeted syncs must insert explicit ids too —
        // plain inserts would get auto-increment ids ai-apply can never match.
        $ids = null;
        $idsFile = (string) ($this->option('ids-file') ?: '');
        if ($idsFile !== '') {
            if (! is_file($idsFile)) {
                $this->error("ids-file not found: {$idsFile}");

                return self::FAILURE;
            }
            $ids = array_flip(array_filter(
                array_map('intval', file($idsFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)),
                fn ($v) => $v > 0
            ));
            $this->info(sprintf('ids-file: importing at most %d specific RecipeId(s) with explicit ids.', count($ids)));
        }

        // Long write transactions + other writers (queue worker) = sqlite
        // "database is locked". Wait up to 60s instead of failing; stop the
        // queue worker around big imports as well.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        if ($this->option('fresh')) {
            $count = Recipe::query()->where('source_url', 'like', self::SOURCE_PREFIX.'%')->count();
            if ($count > 0 && ! $this->confirm("Delete {$count} previously imported Food.com recipes?", true)) {
                return self::FAILURE;
            }
            // recipe_steps cascade via FK.
            Recipe::query()->where('source_url', 'like', self::SOURCE_PREFIX.'%')->delete();
            $this->info("Deleted {$count} previously imported recipes.");
        }

        // Pass 1 (only when --limit is used): collect ratings to find the
        // rating threshold of the top-N rows, so pass 2 can keep only those.
        $threshold = 0.0;
        if ($limit > 0) {
            $this->info('Pass 1/2: scanning ratings to pick the top '.$limit.' recipes...');
            $ratings = [];
            $handle = $this->openCsv($file, $header);
            $i = 0;
            while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
                $ratings[] = (float) ($this->col($row, $header, 'aggregatedrating') ?: 0);
                $i++;
            }
            fclose($handle);
            if ($i <= $limit) {
                $threshold = 0.0;
            } else {
                $sorted = $ratings;
                rsort($sorted);
                $threshold = $sorted[$limit - 1];
            }
            $this->info(sprintf('Top-%d rating threshold: %.2f (%d rows scanned)', min($limit, $i), $threshold, $i));
        }

        // Pass 2: import.
        $this->info('Importing...'.($limit > 0 ? " (keeping up to {$limit})" : ''));
        $handle = $this->openCsv($file, $header);
        $now = Carbon::now()->format('Y-m-d H:i:s');
        $imported = $queued = $skipped = 0;
        $recipeBatch = [];
        $stepsBySource = [];

        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            if ($limit > 0 && $queued >= $limit) {
                break;
            }

            $record = $this->mapRow($row, $header);
            if ($record === null) {
                $skipped++;
                continue;
            }

            if ($ids !== null) {
                $rid = (int) substr($record['source_url'], strlen(self::SOURCE_PREFIX));
                if (! isset($ids[$rid])) {
                    $skipped++;
                    continue;
                }
                $record['id'] = $rid;
            }

            if ($minRating > 0 && $record['rating'] < $minRating) {
                $skipped++;
                continue;
            }
            if ($limit > 0 && $record['rating'] < $threshold) {
                $skipped++;
                continue;
            }
            if ($maxTime > 0 && ($record['time'] ?? 0) > $maxTime) {
                $skipped++;
                continue;
            }

            $stepsBySource[$record['source_url']] = $record['steps'];
            $record['publisher_time_minutes'] = $record['time'];
            unset($record['rating'], $record['steps'], $record['time']);
            $recipeBatch[] = $record + ['created_at' => $now, 'updated_at' => $now];
            $queued++;

            if ($queued % 5000 === 0) {
                $this->info("  {$queued} processed...");
            }
            if (count($recipeBatch) >= self::BATCH) {
                $imported += $this->flush($recipeBatch, $stepsBySource, $now);
            }
        }
        $imported += $this->flush($recipeBatch, $stepsBySource, $now);
        fclose($handle);

        $this->info("Done: {$imported} imported, {$skipped} skipped.");

        return self::SUCCESS;
    }

    /**
     * Insert a batch of recipes, then their recipe_steps, resolving ids via a
     * source_url lookup (batch insert cannot return per-row ids).
     */
    private function flush(array &$recipeBatch, array &$stepsBySource, string $now): int
    {
        if ($recipeBatch === []) {
            return 0;
        }

        $inserted = 0;
        DB::transaction(function () use (&$recipeBatch, &$stepsBySource, $now, &$inserted): void {
            // Skip recipes already present (re-runnable without --fresh), and
            // drop duplicates within the batch itself (the dataset has a few).
            $existing = DB::table('recipes')
                ->whereIn('source_url', array_column($recipeBatch, 'source_url'))
                ->pluck('source_url')
                ->flip()->all();

            $seen = [];
            $new = [];
            foreach ($recipeBatch as $r) {
                if (isset($existing[$r['source_url']]) || isset($seen[$r['source_url']])) {
                    continue;
                }
                $seen[$r['source_url']] = true;
                // Query-builder inserts bypass model casts, so json columns
                // are encoded here. steps_count is denormalized here too
                // (listing scope steps_count >= 2); recipes that already
                // exist keep their value — recipereal:fix-steps recomputes.
                $r['ingredients'] = json_encode($r['ingredients']);
                $r['steps'] = json_encode($stepsBySource[$r['source_url']]);
                $r['steps_count'] = count($stepsBySource[$r['source_url']]);
                $new[] = $r;
            }

            if ($new !== []) {
                DB::table('recipes')->insert($new);
                $idMap = DB::table('recipes')
                    ->whereIn('source_url', array_column($new, 'source_url'))
                    ->pluck('id', 'source_url');

                $stepRows = [];
                foreach ($new as $r) {
                    foreach ($stepsBySource[$r['source_url']] as $i => $description) {
                        $stepRows[] = [
                            'recipe_id' => $idMap[$r['source_url']],
                            'step_number' => $i + 1,
                            'description' => $description,
                            'step_type' => 'active',
                            'publisher_minutes' => null,
                            'community_avg_minutes' => null,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ];
                    }
                }
                // Chunk to stay well under sqlite/MySQL packet limits.
                foreach (array_chunk($stepRows, 1000) as $chunk) {
                    DB::table('recipe_steps')->insert($chunk);
                }
                $inserted = count($new);
            }
        });

        $recipeBatch = [];
        $stepsBySource = [];

        return $inserted;
    }

    /**
     * Map a CSV row to a recipes-table record, or null if it should be skipped
     * (no name, no usable instructions, or no time at all).
     *
     * @return array{title:string,source_url:string,image_url:?string,ingredients:array,steps:array,time:int,rating:float}|null
     */
    private function mapRow(array $row, array $header): ?array
    {
        $title = trim((string) $this->col($row, $header, 'name'));
        if ($title === '' || strlen($title) > 255) {
            return null;
        }

        $id = $this->col($row, $header, 'recipeid');
        if ($id === null || $id === '') {
            return null;
        }

        // Instructions: prefer the list column, fall back to the prose column
        // (which may itself be an R vector, or plain text).
        $instructions = RVector::parse((string) (
            $this->col($row, $header, 'instructionslist')
            ?? $this->col($row, $header, 'recipeinstructionslist')
            ?? ''
        ));
        if ($instructions === []) {
            $prose = trim((string) ($this->col($row, $header, 'recipeinstructions') ?? ''));
            if ($prose === '') {
                return null;
            }
            if (preg_match('/^c\(/i', $prose)) {
                $instructions = RVector::parse($prose);
            } else {
                $instructions = array_values(array_filter(
                    array_map('trim', preg_split('/\r\n|\r|\n|(?<=\.)\s+/', $prose)),
                    fn ($s) => $s !== ''
                ));
            }
        }
        // Drop degenerate steps (bare numbers, single characters) that are
        // common artifacts of sparse rows in the dataset.
        $instructions = array_values(array_filter(
            $instructions,
            fn ($s) => strlen($s) >= 5 && preg_match('/[a-z]/i', $s)
        ));
        if ($instructions === []) {
            return null;
        }

        $parts = RVector::parse((string) ($this->col($row, $header, 'recipeingredientparts') ?? ''));
        $quantities = RVector::parse((string) ($this->col($row, $header, 'recipeingredientquantities') ?? ''));
        $ingredients = [];
        if ($parts !== []) {
            if (count($quantities) === count($parts)) {
                foreach ($parts as $i => $part) {
                    $q = $quantities[$i] ?? '';
                    if (strtoupper($q) === 'NA') {
                        $q = '';
                    }
                    $ingredients[] = trim($q.' '.$part);
                }
            } else {
                $ingredients = $parts;
            }
        }

        $total = $this->durationToMinutes((string) ($this->col($row, $header, 'totaltime') ?? ''));
        if ($total === null || $total <= 0) {
            $total = $this->durationToMinutes((string) ($this->col($row, $header, 'preptime') ?? ''))
                + $this->durationToMinutes((string) ($this->col($row, $header, 'cooktime') ?? ''));
        }
        if ($total === null || $total <= 0) {
            return null; // publisher_time_minutes is the core of the product
        }

        $image = null;
        $images = RVector::parse((string) ($this->col($row, $header, 'images') ?? ''));
        if ($images !== []) {
            // Some CSV rows carry a quoted scalar ("\"https://…\"") whose
            // quotes survive RVector parsing — strip them or every image
            // request for that recipe 404s (device shows the no-photo card).
            $image = substr(trim($images[0], "\"' \t"), 0, 500);
        }

        return [
            'title' => mb_substr($title, 0, 255),
            'source_url' => self::SOURCE_PREFIX.$id,
            'image_url' => $image,
            'ingredients' => $ingredients,
            'steps' => $instructions,
            'time' => $total,
            'rating' => (float) ($this->col($row, $header, 'aggregatedrating') ?: 0),
        ];
    }

    /**
     * ISO-8601 duration (PT1H30M, P1DT2H, PT45M) → total minutes.
     */
    private function durationToMinutes(string $value): ?int
    {
        $value = trim($value);
        if ($value === '' || strtoupper($value) === 'NULL' || strtoupper($value) === 'NA') {
            return null;
        }
        if (! preg_match('/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i', $value, $m)) {
            return null;
        }

        $minutes = ((int) ($m[1] ?? 0)) * 24 * 60
            + ((int) ($m[2] ?? 0)) * 60
            + (int) ($m[3] ?? 0);

        return $minutes;
    }

    /**
     * @param  list<string>  $header  lowercase column names
     */
    private function col(array $row, array $header, string $name): ?string
    {
        $i = array_search($name, $header, true);
        if ($i === false || ! array_key_exists($i, $row)) {
            return null;
        }
        $value = $row[$i];

        return $value === null ? null : (string) $value;
    }

    /**
     * @param  list<string>  $header  lowercase, BOM-stripped column names (out-param)
     */
    private function openCsv(string $file, ?array &$header)
    {
        $handle = fopen($file, 'r');
        if ($handle === false) {
            throw new \RuntimeException("Cannot open {$file}");
        }
        $header = fgetcsv($handle, 0, ',', '"', '\\');
        if ($header === false) {
            fclose($handle);
            throw new \RuntimeException('Empty CSV (no header row).');
        }
        // Strip BOM + whitespace, lowercase for stable lookups.
        $header = array_map(
            fn ($h) => strtolower(trim(str_replace("\xEF\xBB\xBF", '', (string) $h))),
            $header
        );

        return $handle;
    }
}
