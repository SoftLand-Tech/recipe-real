<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Fills in Food.com metadata (rating, category, keywords, description,
 * nutrition) for recipes imported by recipereal:import-foodcom.
 *
 * Expected file: a COMPACT metadata CSV (plain or gzip, .gz) with EXACTLY
 * this header:
 *
 *   RecipeId,AggregatedRating,ReviewCount,RecipeCategory,Keywords,Description,Calories,ProteinContent,FatContent
 *
 * Keywords is already a JSON array string (["a","b"]) — NOT an R vector.
 * RecipeId is mapped onto the existing source_url
 * (https://www.food.com/recipe/{id}); rows whose recipe was never imported
 * are skipped and counted. Existing rows are UPDATEd only (chunked, one
 * transaction per 500-row batch), so the command is re-runnable and never
 * creates recipes.
 */
class ImportFoodcomMeta extends Command
{
    protected $signature = 'recipereal:import-foodcom-meta
        {file : Path to the compact metadata CSV (plain or .gz)}
        {--start-after= : resume: skip rows until this RecipeId seen}';

    protected $description = 'Update imported Food.com recipes with rating/category/keywords/nutrition metadata.';

    private const SOURCE_PREFIX = 'https://www.food.com/recipe/';

    private const BATCH = 500;

    private const PROGRESS_EVERY = 25000;

    /** Max keywords kept per recipe. */
    private const MAX_KEYWORDS = 20;

    /** Max characters per keyword. */
    private const KEYWORD_MAX_LEN = 60;

    /** Max characters of Description stored. */
    private const DESCRIPTION_MAX_LEN = 2000;

    public function handle(): int
    {
        $file = (string) $this->argument('file');
        if (! is_file($file)) {
            $this->error("File not found: {$file}");

            return self::FAILURE;
        }

        $startAfter = trim((string) ($this->option('start-after') ?: ''));

        // Long write transactions + other writers (queue worker) = sqlite
        // "database is locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info('Updating recipe metadata...'.($startAfter !== '' ? " (resuming after RecipeId {$startAfter})" : ''));

        $handle = $this->openCsv($file, $header);
        $now = Carbon::now()->format('Y-m-d H:i:s');
        $scanned = $updated = $missing = 0;
        $batch = [];
        $resuming = $startAfter !== '';

        while (($row = fgetcsv($handle, 0, ',', '"', '\\')) !== false) {
            $scanned++;

            if ($scanned % self::PROGRESS_EVERY === 0) {
                $this->info(sprintf('  %s rows scanned, %s updated, %s missing...', number_format($scanned), number_format($updated), number_format($missing)));
            }

            $record = $this->mapRow($row, $header);
            if ($record === null) {
                continue; // header only ever has well-formed ids; ignore blanks
            }

            // --start-after: skip until the given RecipeId is seen, then
            // process from that row onwards (re-updating it is harmless —
            // updates are idempotent — and covers a mid-batch interruption).
            if ($resuming) {
                if ($record['source_url'] === self::SOURCE_PREFIX.$startAfter) {
                    $resuming = false;
                } else {
                    continue;
                }
            }

            $batch[] = $record;
            if (count($batch) >= self::BATCH) {
                [$u, $m] = $this->flush($batch, $now);
                $updated += $u;
                $missing += $m;
            }
        }
        [$u, $m] = $this->flush($batch, $now);
        $updated += $u;
        $missing += $m;
        fclose($handle);

        $this->info(sprintf('Done: %s rows scanned, %s recipes updated, %s skipped (recipe not imported).', number_format($scanned), number_format($updated), number_format($missing)));

        return self::SUCCESS;
    }

    /**
     * UPDATE the recipes of one batch (existing rows only), inside a single
     * transaction. Returns [updated, missing].
     *
     * @param  list<array{source_url:string,...}>  $batch
     * @return array{0:int,1:int}
     */
    private function flush(array &$batch, string $now): array
    {
        if ($batch === []) {
            return [0, 0];
        }

        $updated = $missing = 0;

        DB::transaction(function () use (&$batch, $now, &$updated, &$missing): void {
            $ids = DB::table('recipes')
                ->whereIn('source_url', array_column($batch, 'source_url'))
                ->pluck('id', 'source_url');

            foreach ($batch as $record) {
                $sourceUrl = $record['source_url'];
                $id = $ids[$sourceUrl] ?? null;
                if ($id === null) {
                    $missing++;

                    continue;
                }
                unset($record['source_url']);
                // PK-qualified updates, no model events — sqlite-friendly.
                DB::table('recipes')->where('id', $id)->update($record + ['updated_at' => $now]);
                $updated++;
            }
        });

        $batch = [];

        return [$updated, $missing];
    }

    /**
     * Map a CSV row to a recipes-table update payload, or null when the row
     * has no RecipeId. Empty / NA values become null.
     *
     * @param  list<string>  $header  lowercase column names
     * @return array{source_url:string,aggregated_rating:?float,review_count:?int,category:?string,keywords:?string,description:?string,calories:?float,protein_g:?float,fat_g:?float}|null
     */
    private function mapRow(array $row, array $header): ?array
    {
        $id = trim((string) ($this->col($row, $header, 'recipeid') ?? ''));
        if ($id === '') {
            return null;
        }

        $keywords = $this->sanitizeKeywords((string) ($this->col($row, $header, 'keywords') ?? ''));

        $description = trim((string) ($this->col($row, $header, 'description') ?? ''));
        if ($description !== '' && strtoupper($description) === 'NA') {
            $description = '';
        }
        $description = $description === '' ? null : mb_substr($description, 0, self::DESCRIPTION_MAX_LEN);

        $category = trim((string) ($this->col($row, $header, 'recipecategory') ?? ''));
        if ($category !== '' && strtoupper($category) === 'NA') {
            $category = '';
        }
        $category = $category === '' ? null : mb_substr($category, 0, 255);

        return [
            'source_url' => self::SOURCE_PREFIX.$id,
            'aggregated_rating' => $this->toFloat($this->col($row, $header, 'aggregatedrating')),
            'review_count' => $this->toInt($this->col($row, $header, 'reviewcount')),
            'category' => $category,
            // Query-builder updates bypass model casts, so encode here.
            'keywords' => $keywords === null ? null : json_encode($keywords, JSON_UNESCAPED_UNICODE),
            'description' => $description,
            'calories' => $this->toFloat($this->col($row, $header, 'calories')),
            'protein_g' => $this->toFloat($this->col($row, $header, 'proteincontent')),
            'fat_g' => $this->toFloat($this->col($row, $header, 'fatcontent')),
        ];
    }

    /**
     * Decode a JSON array string (["a","b"]), trim + cap the entries, and
     * re-encode. Returns null when empty or not a JSON array.
     */
    private function sanitizeKeywords(string $value): ?array
    {
        $value = trim($value);
        if ($value === '' || strtoupper($value) === 'NA') {
            return null;
        }

        $list = json_decode($value, true);
        if (! is_array($list)) {
            return null;
        }

        $out = [];
        foreach ($list as $keyword) {
            $keyword = trim((string) $keyword);
            if ($keyword === '') {
                continue;
            }
            $out[] = mb_substr($keyword, 0, self::KEYWORD_MAX_LEN);
        }

        $out = array_values(array_slice(array_unique($out), 0, self::MAX_KEYWORDS));

        return $out === [] ? null : $out;
    }

    private function toFloat(?string $value): ?float
    {
        $value = trim((string) ($value ?? ''));
        if ($value === '' || strtoupper($value) === 'NA' || ! is_numeric($value)) {
            return null;
        }

        return (float) $value;
    }

    private function toInt(?string $value): ?int
    {
        $float = $this->toFloat($value);

        return $float === null ? null : (int) round($float);
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
     * Binary-safe CSV open: transparently reads gzip files via the
     * compress.zlib:// stream wrapper (fgetcsv works on it unchanged).
     *
     * @param  list<string>  $header  lowercase, BOM-stripped column names (out-param)
     */
    private function openCsv(string $file, ?array &$header)
    {
        $stream = preg_match('/\.gz$/i', $file) === 1 ? 'compress.zlib://'.$file : $file;

        $handle = fopen($stream, 'r');
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
