<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Imports recipes from the AI batch pipeline's 500-input.jsonl files (the
 * project's source of truth for the id space — NOT the Kaggle CSV, whose
 * RecipeId universe is entirely different).
 *
 * Input: one JSON object per line:
 *   {"id":123,"title":str,"description":str|null,
 *    "publisher_time_minutes":int|null,"category":str|null,
 *    "rating":float|null,"reviews":int|null,
 *    "ingredients":[str,...],
 *    "steps":[{"step_id":456,"step_number":1,"description":str},...]}
 *
 * Behaviour:
 *  - recipes.id = the JSONL id (ai-apply keys on it);
 *    recipe_steps.id = step_id (explicit, so ai-apply's step matching works
 *    without positional fallback). Feed files must therefore be deduped by
 *    recipe id beforehand (duplicate recipes share step ids).
 *  - ids already present are skipped (re-runnable without --fresh).
 *  - Run only on files whose recipes passed the halal filter — this command
 *    is the last gate before the halal-only app DB.
 */
class ImportBatches extends Command
{
    protected $signature = 'recipereal:import-batches
        {file : Path to a merged 500-input JSONL file (plain or .gz)}
        {--fresh : Delete ALL batch-imported recipes first (source_type in [foodcom, batch]}';

    protected $description = 'Import recipes (explicit ids) from the AI batch pipeline input JSONL.';

    private const TX_BATCH = 200;

    private int $imported = 0;

    private int $skippedExisting = 0;

    private int $malformed = 0;

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        $stream = fopen(str_ends_with(strtolower($file), '.gz') ? 'compress.zlib://'.$file : $file, 'rb');
        if ($stream === false) {
            $this->error("Cannot open: {$file}");

            return self::FAILURE;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        if ($this->option('fresh')) {
            $n = DB::table('recipe_steps')->whereIn('recipe_id', DB::table('recipes')
                ->whereIn('source_type', ['foodcom', 'batch'])->select('id'))->delete();
            $m = DB::table('recipes')->whereIn('source_type', ['foodcom', 'batch'])->delete();
            $this->info("Fresh: removed {$m} recipes / {$n} steps.");
        }

        $now = Carbon::now()->format('Y-m-d H:i:s');
        $buffer = [];
        while (($line = fgets($stream)) !== false) {
            if (trim($line) === '') {
                continue;
            }
            $r = json_decode($line, true);
            if (! is_array($r) || ! isset($r['id'], $r['title'])) {
                $this->malformed++;
                continue;
            }
            $buffer[] = $r;
            if (count($buffer) >= self::TX_BATCH) {
                $this->flush($buffer, $now);
                $buffer = [];
            }
        }
        if ($buffer !== []) {
            $this->flush($buffer, $now);
        }
        fclose($stream);

        $this->info(sprintf('Done: %d imported, %d already present, %d malformed.', $this->imported, $this->skippedExisting, $this->malformed));

        return self::SUCCESS;
    }

    /**
     * @param  list<array>  $batch
     */
    private function flush(array $batch, string $now): void
    {
        DB::transaction(function () use ($batch, $now): void {
            $existing = DB::table('recipes')
                ->whereIn('id', array_column($batch, 'id'))
                ->pluck('id')->flip()->all();

            $recipeRows = [];
            $stepRows = [];
            $seen = [];
            foreach ($batch as $r) {
                $id = (int) $r['id'];
                if (isset($existing[$id]) || isset($seen[$id])) {
                    $this->skippedExisting++;
                    continue;
                }
                $seen[$id] = true;

                $steps = [];
                foreach ((array) ($r['steps'] ?? []) as $i => $s) {
                    $steps[] = (string) ($s['description'] ?? '');
                    $sid = $s['step_id'] ?? null;
                    $stepRows[] = [
                        'id' => is_numeric($sid) ? (int) $sid : null,
                        'recipe_id' => $id,
                        'step_number' => (int) ($s['step_number'] ?? ($i + 1)),
                        'description' => (string) ($s['description'] ?? ''),
                        'step_type' => 'active',
                        'publisher_minutes' => null,
                        'community_avg_minutes' => null,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];
                }

                $recipeRows[] = [
                    'id' => $id,
                    'title' => (string) $r['title'],
                    'source_url' => 'https://www.food.com/recipe/'.$id,
                    'description' => isset($r['description']) && is_string($r['description']) && $r['description'] !== ''
                        ? $r['description'] : null,
                    'publisher_time_minutes' => isset($r['publisher_time_minutes']) ? (int) $r['publisher_time_minutes'] : null,
                    'category' => is_string($r['category'] ?? null) && $r['category'] !== '' ? $r['category'] : null,
                    'aggregated_rating' => isset($r['rating']) && is_numeric($r['rating']) ? (float) $r['rating'] : null,
                    'review_count' => isset($r['reviews']) && is_numeric($r['reviews']) ? (int) $r['reviews'] : null,
                    'ingredients' => json_encode(array_map('strval', (array) ($r['ingredients'] ?? [])), JSON_UNESCAPED_UNICODE) ?: '[]',
                    'steps' => json_encode($steps, JSON_UNESCAPED_UNICODE) ?: '[]',
                    'steps_count' => count($steps),
                    'source_type' => 'batch',
                    'owner_id' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $this->imported++;
            }

            foreach (array_chunk($recipeRows, 200) as $chunk) {
                DB::table('recipes')->insertOrIgnore($chunk);
            }
            foreach (array_chunk($stepRows, 500) as $chunk) {
                // drop rows whose step_id collided (deduped feed should have none)
                $chunk = array_values(array_filter($chunk, fn ($row) => $row['id'] !== null));
                if ($chunk !== []) {
                    DB::table('recipe_steps')->insertOrIgnore($chunk);
                }
            }
        });
    }
}
