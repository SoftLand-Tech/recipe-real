<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use stdClass;

/**
 * Applies AI-extracted recipe data (Arabic translations, cleaned titles and
 * categories, per-step minutes) from a JSONL output file.
 *
 * Input: one JSON object per line, plain or gzip-compressed (.gz is opened
 * through the compress.zlib:// stream wrapper). Expected per-line shape:
 *
 *   {"id":123,"title_clean":str|null,"title_ar":str,
 *    "ingredients_ar":["..."],"steps":[{"step_id":456,"description_ar":"...",
 *    "description_en":str|null,"minutes_estimated":int,
 *    "step_type":"active|passive|cleanup"}],"steps_ar":["..."],
 *    "servings":int|null,"category_clean":str|null,"junk":bool,"notes":str}
 *
 * Behaviour:
 *  - junk:true records are never applied; their ids are counted in the
 *    summary so recipereal:wipe-unreviewed (which reads the junk flag from
 *    the same files) can delete them.
 *  - ingredients_ar / steps_ar are only written when their lengths match the
 *    recipe's current ingredients/steps counts — otherwise that FIELD is
 *    skipped with a warning (per-step data is still applied). A bad record
 *    never aborts the run.
 *  - minutes_estimated is clamped to 0..1440 and written to the new
 *    recipe_steps.ai_minutes column; description_en overwrites description
 *    when non-null/non-empty.
 *  - Writes happen in transactions of 200 records; every write is keyed by
 *    id, so re-running the same file (or resuming after a crash) is safe.
 *  - servings has no column yet — counted and reported only.
 */
class AiApply extends Command
{
    protected $signature = 'recipereal:ai-apply
        {file : Path to an AI-output JSONL file (plain or .gz)}
        {--dry-run : Parse, validate and report without writing}';

    protected $description = 'Apply AI-extracted Arabic fields, cleaned titles and per-step minutes from a JSONL file.';

    private const TX_BATCH = 200;

    private const PROGRESS_EVERY = 500;

    private const MAX_MINUTES = 1440;

    /** @var list<string> */
    private const STEP_TYPES = ['active', 'passive', 'cleanup'];

    private int $processed = 0;

    private int $lastProgressAt = 0;

    private int $applied = 0;

    private int $stepsUpdated = 0;

    private int $skippedSteps = 0;

    private int $missingRecipes = 0;

    private int $malformed = 0;

    private int $ingredientsSkipped = 0;

    private int $stepsArSkipped = 0;

    private int $servingsSeen = 0;

    private int $realityRefreshed = 0;

    /** @var array<int, true> */
    private array $junkIds = [];

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        $dryRun = (bool) $this->option('dry-run');

        $stream = $this->openFile($file);
        if ($stream === null) {
            return self::FAILURE;
        }

        // Long write transactions + other writers = sqlite "database is
        // locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info(sprintf('Reading %s%s...', $file, $dryRun ? ' (dry run)' : ''));
        $started = microtime(true);

        $buffer = [];
        try {
            while (($line = fgets($stream)) !== false) {
                if (trim($line) === '') {
                    continue;
                }

                $record = json_decode($line, true);
                if (! is_array($record)) {
                    $this->malformed++;
                    $this->processed++;
                    $this->warn('Malformed JSON line, skipped.');

                    continue;
                }

                $buffer[] = $record;
                if (count($buffer) >= self::TX_BATCH) {
                    $this->flush($buffer, $dryRun);
                    $buffer = [];
                }
            }
            if ($buffer !== []) {
                $this->flush($buffer, $dryRun);
            }
        } finally {
            fclose($stream);
        }

        $this->newLine();
        $this->info(sprintf('Summary (%.1fs):', microtime(true) - $started));
        $this->line(sprintf('  Records processed:  %d', $this->processed));
        $this->line(sprintf('  Recipes applied:    %d (%d not found, skipped)', $this->applied, $this->missingRecipes));
        $this->line(sprintf('  Steps updated:      %d (%d skipped: missing/foreign step_id)', $this->stepsUpdated, $this->skippedSteps));
        $this->line(sprintf('  Junk to remove:     %d recipe id(s) — not applied, excluded from the wipe keep-set', count($this->junkIds)));
        $this->line(sprintf('  Fields skipped:     ingredients_ar %d, steps_ar %d (length mismatch)', $this->ingredientsSkipped, $this->stepsArSkipped));
        $this->line(sprintf('  Malformed records:  %d', $this->malformed));
        if ($this->servingsSeen > 0) {
            $this->line(sprintf('  Servings on %d record(s) — no column yet, ignored.', $this->servingsSeen));
        }
        if ($this->realityRefreshed > 0) {
            $this->line(sprintf('  Reality refreshed: %d recipe(s) via Recipe::recalculateReality()', $this->realityRefreshed));
        }
        if ($dryRun) {
            $this->info('Dry run: nothing was written.');
        }

        return self::SUCCESS;
    }

    /**
     * Apply a batch of records inside one transaction (skipped on dry run).
     *
     * @param  list<array>  $batch
     */
    private function flush(array $batch, bool $dryRun): void
    {
        if ($dryRun) {
            foreach ($batch as $record) {
                $this->processRecord($record, true);
            }
        } else {
            DB::transaction(function () use ($batch): void {
                foreach ($batch as $record) {
                    $this->processRecord($record, false);
                }
            });
        }

        $this->processed += count($batch);
        if ($this->processed - $this->lastProgressAt >= self::PROGRESS_EVERY) {
            $this->lastProgressAt = $this->processed;
            $this->info(sprintf('  %d records — %d recipes applied, %d steps updated', $this->processed, $this->applied, $this->stepsUpdated));
        }
    }

    /**
     * Validate and (unless dry run) write one record. A junk record only
     * records its id; nothing is ever applied for it.
     *
     * @param  array  $record
     */
    private function processRecord(array $record, bool $dryRun): void
    {
        $id = $record['id'] ?? null;
        if (! is_numeric($id) || (int) $id < 1) {
            $this->malformed++;
            $this->warn('Record without a valid id, skipped.');

            return;
        }
        $id = (int) $id;

        if (! empty($record['junk'])) {
            // Junk recipes are deleted by recipereal:wipe-unreviewed, never
            // updated here.
            $this->junkIds[$id] = true;

            return;
        }

        $recipe = DB::table('recipes')->where('id', $id)->first();
        if ($recipe === null) {
            $this->missingRecipes++;
            $this->warn("Recipe #{$id} not found, skipped.");

            return;
        }

        $updates = [];

        $titleAr = $record['title_ar'] ?? null;
        if (is_string($titleAr) && $titleAr !== '') {
            $updates['title_ar'] = $titleAr;
        }

        $titleClean = $record['title_clean'] ?? null;
        if (is_string($titleClean) && trim($titleClean) !== '') {
            $updates['title'] = trim($titleClean);
        }

        $category = $record['category_clean'] ?? null;
        if (is_string($category) && trim($category) !== '') {
            $updates['category'] = trim($category);
        }

        $ingredientsAr = $record['ingredients_ar'] ?? null;
        if (is_array($ingredientsAr)) {
            $current = $this->currentIngredientsCount($recipe);
            if (count($ingredientsAr) !== $current) {
                $this->ingredientsSkipped++;
                $this->warn(sprintf('Recipe #%d: ingredients_ar has %d item(s) vs %d in db — field skipped.', $id, count($ingredientsAr), $current));
            } else {
                $updates['ingredients_ar'] = $ingredientsAr === [] ? null : self::encodeList($ingredientsAr);
            }
        }

        $stepsAr = $record['steps_ar'] ?? null;
        if (is_array($stepsAr)) {
            $current = $this->currentStepsCount($recipe);
            if (count($stepsAr) !== $current) {
                $this->stepsArSkipped++;
                $this->warn(sprintf('Recipe #%d: steps_ar has %d item(s) vs %d steps in db — field skipped.', $id, count($stepsAr), $current));
            } else {
                $updates['steps_ar'] = $stepsAr === [] ? null : self::encodeList($stepsAr);
            }
        }

        if (array_key_exists('servings', $record) && $record['servings'] !== null) {
            $this->servingsSeen++;
        }

        $stepUpdates = $this->stepUpdates($record, $id);

        if ($dryRun) {
            if ($updates !== [] || $stepUpdates !== []) {
                $this->applied++;
            }
            $this->stepsUpdated += count($stepUpdates);

            return;
        }

        if ($updates !== []) {
            DB::table('recipes')->where('id', $id)->update($updates);
        }
        foreach ($stepUpdates as $stepId => $fields) {
            DB::table('recipe_steps')->where('id', $stepId)->update($fields);
        }

        // Fresh per-step minutes change the Reality Index estimate (when
        // the recipe has no community average yet — recalculateReality()
        // decides). Only touched when this record actually carried
        // minutes, so records with translations alone stay cheap.
        foreach ($stepUpdates as $fields) {
            if (array_key_exists('ai_minutes', $fields)) {
                $recipeModel = Recipe::find($id);
                if ($recipeModel !== null && $recipeModel->recalculateReality()) {
                    $this->realityRefreshed++;
                }
                break;
            }
        }

        if ($updates !== [] || $stepUpdates !== []) {
            $this->applied++;
        }
        $this->stepsUpdated += count($stepUpdates);
    }

    /**
     * Build the per-step updates for a record. step_id must exist AND belong
     * to the recipe, else the step is warned about and skipped.
     *
     * @param  array  $record
     * @return array<int, array<string, mixed>>
     */
    private function stepUpdates(array $record, int $recipeId): array
    {
        $steps = $record['steps'] ?? null;
        if (! is_array($steps) || $steps === []) {
            return [];
        }

        $known = array_flip(
            DB::table('recipe_steps')->where('recipe_id', $recipeId)->pluck('id')->all()
        );

        $updates = [];
        foreach ($steps as $step) {
            if (! is_array($step)) {
                $this->skippedSteps++;
                $this->warn("Recipe #{$recipeId}: non-object step entry, skipped.");

                continue;
            }

            $stepId = $step['step_id'] ?? null;
            if (! is_numeric($stepId) || ! isset($known[(int) $stepId])) {
                $this->skippedSteps++;
                $this->warn(sprintf('Recipe #%d: step_id %s not found on this recipe, skipped.', $recipeId, var_export($stepId, true)));

                continue;
            }

            $fields = [];

            $descriptionAr = $step['description_ar'] ?? null;
            if (is_string($descriptionAr) && $descriptionAr !== '') {
                $fields['description_ar'] = $descriptionAr;
            }

            $descriptionEn = $step['description_en'] ?? null;
            if (is_string($descriptionEn) && trim($descriptionEn) !== '') {
                $fields['description'] = trim($descriptionEn);
            }

            if (isset($step['minutes_estimated']) && is_numeric($step['minutes_estimated'])) {
                $fields['ai_minutes'] = min(self::MAX_MINUTES, max(0, (float) $step['minutes_estimated']));
            }

            // derive_times.py output: the time literally stated in this
            // step's source text — the cooking-mode alarm anchor. Applied
            // exactly like ai_minutes (clamped, keyed by step_id, safe to
            // re-run); absent/null leaves the column untouched.
            if (isset($step['literal_minutes']) && is_numeric($step['literal_minutes'])) {
                $fields['literal_minutes'] = min(self::MAX_MINUTES, max(0, (float) $step['literal_minutes']));
            }

            $type = $step['step_type'] ?? null;
            if (is_string($type) && in_array($type, self::STEP_TYPES, true)) {
                $fields['step_type'] = $type;
            } elseif ($type !== null) {
                $this->warn("Recipe #{$recipeId} step #".(int) $stepId.": unknown step_type '".var_export($type, true)."', field skipped.");
            }

            if ($fields !== []) {
                $updates[(int) $stepId] = $fields;
            }
        }

        return $updates;
    }

    /**
     * Current ingredient count of the recipe (decoded from the json column).
     */
    private function currentIngredientsCount(stdClass $recipe): int
    {
        $decoded = json_decode((string) $recipe->ingredients, true);

        return is_array($decoded) ? count($decoded) : 0;
    }

    /**
     * Current step count of the recipe: the decoded steps json (the list
     * steps_ar is the translation of, cf. TranslateArabic), falling back to
     * the steps_count column when the json column is missing.
     */
    private function currentStepsCount(stdClass $recipe): int
    {
        $decoded = json_decode((string) $recipe->steps, true);
        if (is_array($decoded) && $decoded !== []) {
            return count($decoded);
        }

        return (int) $recipe->steps_count;
    }

    /**
     * Encode an Arabic string list the way the _ar columns are stored (raw
     * JSON string, no model cast) — see TranslateArabic.
     *
     * @param  list<string>  $items
     */
    private static function encodeList(array $items): string
    {
        return json_encode(array_map('strval', $items), JSON_UNESCAPED_UNICODE);
    }

    /**
     * Open a JSONL file for reading, transparently handling .gz via the
     * compress.zlib:// wrapper.
     *
     * @return resource|null
     */
    private function openFile(string $path)
    {
        if (! is_file($path)) {
            $this->error("File not found: {$path}");

            return null;
        }

        $stream = fopen(str_ends_with(strtolower($path), '.gz') ? 'compress.zlib://'.$path : $path, 'rb');
        if ($stream === false) {
            $this->error("Cannot open: {$path}");

            return null;
        }

        return $stream;
    }
}
