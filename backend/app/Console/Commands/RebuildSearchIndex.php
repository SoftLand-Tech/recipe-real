<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Rebuilds the recipes_fts contentless FTS5 index from scratch.
 *
 * Run once after migrating (000017) and again after any bulk write that
 * bypasses the sync triggers (e.g. a fresh recipereal:import-foodcom with
 * --fresh). Uses the FTS5 'delete-all' command to clear, then re-indexes in
 * id-ordered chunks (10k rows per transaction) — ~30-60s for the 520k-row
 * production database.
 */
class RebuildSearchIndex extends Command
{
    protected $signature = 'recipereal:rebuild-search';

    protected $description = 'Rebuild the recipes_fts full-text search index.';

    private const CHUNK = 10000;

    /** Rows per multi-value INSERT statement (statement size, not transaction). */
    private const INSERT_BATCH = 500;

    private const PROGRESS_EVERY = 50000;

    public function handle(): int
    {
        if (DB::connection()->getDriverName() !== 'sqlite') {
            $this->error('recipes_fts is SQLite-only (FTS5); current driver: '.DB::connection()->getDriverName());

            return self::FAILURE;
        }

        // Long write transactions + other writers = sqlite "database is
        // locked". Wait up to 60s instead of failing.
        DB::statement('PRAGMA busy_timeout = 60000');

        $total = (int) DB::table('recipes')->count();
        $this->info("Clearing recipes_fts and indexing {$total} recipes...");

        // 'delete-all' empties a contentless table (plain DELETE/UPDATE are
        // not supported on it).
        DB::statement("INSERT INTO recipes_fts(recipes_fts) VALUES('delete-all')");

        $indexed = 0;
        $lastId = 0;
        $started = microtime(true);

        while (true) {
            // Fetch the next id-ordered chunk with the exact index-time
            // expressions (must mirror the sync triggers in migration 000017).
            $rows = DB::select(
                'SELECT id AS rowid, lower(title) AS title, '
                ."COALESCE(ingredients, '') AS ingredients, "
                ."COALESCE(description, '') AS description "
                .'FROM recipes WHERE id > ? ORDER BY id LIMIT '.self::CHUNK,
                [$lastId]
            );
            if ($rows === []) {
                break;
            }

            DB::transaction(function () use ($rows): void {
                foreach (array_chunk($rows, self::INSERT_BATCH) as $batch) {
                    DB::table('recipes_fts')->insert(
                        array_map(fn ($row) => (array) $row, $batch)
                    );
                }
            });

            $indexed += count($rows);
            $lastId = (int) end($rows)->rowid;

            if ($indexed % self::PROGRESS_EVERY === 0 || $indexed >= $total) {
                $this->info(sprintf('  %d / %d (%.1fs)', $indexed, $total, microtime(true) - $started));
            }
        }

        // Sanity check: the index should hold one row per recipe.
        try {
            $ftsCount = (int) DB::selectOne('SELECT COUNT(*) AS c FROM recipes_fts')->c;
        } catch (Throwable) {
            $ftsCount = $indexed; // count scan failed; fall back to bookkeeping
        }

        if ($ftsCount !== $total) {
            $this->error("Done, but count mismatch: recipes_fts has {$ftsCount} rows vs {$total} recipes.");

            return self::FAILURE;
        }

        $this->info("Done: {$ftsCount} recipes indexed in ".sprintf('%.1fs.', microtime(true) - $started));

        return self::SUCCESS;
    }
}
