<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Deletes every recipe that is NOT in the keep set built from one or more
 * --keep-file JSONL files (plain or .gz). Each line needs at least
 * {"id":123}; when a "junk" flag is present and truthy the id is treated as
 * junk and REMOVED from the keep set (junk recipes are deleted, not kept) —
 * so the AI output files can be fed straight in.
 *
 * Safety: refuses to run when the keep set is empty or below MIN_KEEP
 * recipes — a truncated/typoed keep file must never wipe the corpus.
 *
 * recipe_steps, cook_sessions, recipe_views and timing_submissions cascade
 * via FK (sqlite: enforced, PRAGMA foreign_keys is forced ON); the removed
 * session/view/submission counts are reported.
 *
 * Without --apply it only prints the dry-run report. With --apply it
 * deletes in chunked transactions, then rebuilds the FTS index
 * (recipereal:rebuild-search) and clears the cache, and prints final
 * counts.
 */
class WipeUnreviewed extends Command
{
    protected $signature = 'recipereal:wipe-unreviewed
        {--keep-file=* : JSONL file(s) of kept recipe ids (repeatable; junk-flagged ids are excluded)}
        {--apply : Actually delete — without it, dry-run report only}';

    protected $description = 'Delete every recipe whose id is not in the keep-file set (dry-run unless --apply).';

    /** Minimum keep-set size; anything smaller is treated as an error. */
    private const MIN_KEEP = 100;

    private const INSERT_BATCH = 500;

    private const DELETE_CHUNK = 1000;

    private const PROGRESS_EVERY = 10000;

    public function handle(): int
    {
        $files = array_values(array_filter(array_map('strval', (array) $this->option('keep-file'))));
        if ($files === []) {
            $this->error('No --keep-file given — refusing to wipe everything.');

            return self::FAILURE;
        }

        [$keep, $junkCount, $malformed] = $this->readKeepSet($files);
        $keepCount = count($keep);

        if ($keepCount < self::MIN_KEEP) {
            $this->error(sprintf(
                'Keep set has only %d id(s) (minimum %d, %d junk-flagged excluded) — refusing to run. Check the keep file(s).',
                $keepCount,
                self::MIN_KEEP,
                $junkCount,
            ));

            return self::FAILURE;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        // Keep ids go into a temp table: the set can exceed any sane
        // NOT IN() parameter list on production-scale imports.
        DB::statement('CREATE TEMPORARY TABLE keep_ids (id INTEGER PRIMARY KEY)');
        foreach (array_chunk($keep, self::INSERT_BATCH) as $chunk) {
            DB::table('keep_ids')->insert(array_map(fn ($id) => ['id' => $id], $chunk));
        }

        // SAFETY: user-created recipes (source_type='user') are ALWAYS kept,
        // regardless of the keep files — their content exists only in this
        // database, so wiping one on a re-run would be unrecoverable data
        // loss. Junk flags cannot opt them out either.
        $userRecipesKept = (int) DB::selectOne(
            "SELECT COUNT(*) AS c FROM recipes WHERE source_type = 'user'"
        )->c;
        if ($userRecipesKept > 0) {
            DB::statement(
                "INSERT OR IGNORE INTO keep_ids (id) SELECT id FROM recipes WHERE source_type = 'user'"
            );
        }

        $totalRecipes = $this->countTable('recipes');
        $keptExisting = (int) DB::selectOne(
            'SELECT COUNT(*) AS c FROM recipes r WHERE EXISTS (SELECT 1 FROM keep_ids k WHERE k.id = r.id)'
        )->c;
        $toDelete = $totalRecipes - $keptExisting;

        // Cascade victims (FK cascadeOnDelete on recipe_id / recipe_step_id).
        $stepsBefore = $this->countTable('recipe_steps');
        $sessionsBefore = $this->countTable('cook_sessions');
        $viewsBefore = $this->countTable('recipe_views');
        $timingBefore = $this->countTable('timing_submissions');
        $stepsToGo = $this->countOrphans('recipe_steps', 'recipe_id');
        $sessionsToGo = $this->countOrphans('cook_sessions', 'recipe_id');
        $viewsToGo = $this->countOrphans('recipe_views', 'recipe_id');
        $timingToGo = $this->countOrphans('timing_submissions', 'recipe_step_id', 'recipe_steps', 'recipe_id');

        $this->info(sprintf(
            'Keep set: %d distinct id(s) (%d junk-flagged excluded, %d malformed line(s) ignored); %d exist in the database; %d user-created recipe(s) always kept.',
            $keepCount,
            $junkCount,
            $malformed,
            $keptExisting,
            $userRecipesKept,
        ));

        if (! $this->option('apply')) {
            $this->info(sprintf(
                'Would delete %d of %d recipe(s) — cascading: %d step(s), %d cook session(s), %d recipe view(s), %d timing submission(s).',
                $toDelete,
                $totalRecipes,
                $stepsToGo,
                $sessionsToGo,
                $viewsToGo,
                $timingToGo,
            ));
            $this->info('Dry run only — re-run with --apply to delete.');

            return self::SUCCESS;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            // Cascades (recipe_steps, cook_sessions, ...) only fire with FK
            // enforcement on — force it regardless of the .env default.
            DB::statement('PRAGMA foreign_keys = ON');
        }

        $this->info("Deleting {$toDelete} recipe(s)...");
        $deleted = 0;
        while (true) {
            $ids = array_map('intval', array_column(DB::select(
                'SELECT id FROM recipes WHERE id NOT IN (SELECT id FROM keep_ids) ORDER BY id LIMIT '.self::DELETE_CHUNK
            ), 'id'));
            if ($ids === []) {
                break;
            }

            DB::transaction(function () use ($ids): void {
                DB::table('recipes')->whereIn('id', $ids)->delete();
            });

            $deleted += count($ids);
            if ($deleted % self::PROGRESS_EVERY === 0 || $deleted >= $toDelete) {
                $this->info("  {$deleted} deleted");
            }
        }

        $recipesAfter = $this->countTable('recipes');
        $stepsAfter = $this->countTable('recipe_steps');
        $sessionsRemoved = $sessionsBefore - $this->countTable('cook_sessions');
        $viewsRemoved = $viewsBefore - $this->countTable('recipe_views');
        $timingRemoved = $timingBefore - $this->countTable('timing_submissions');

        if ($recipesAfter !== $keptExisting) {
            $this->error("Count mismatch after delete: {$recipesAfter} recipes remain, expected {$keptExisting}.");
        }

        $this->info(sprintf(
            'Deleted %d recipe(s) — %d kept, %d step(s) remaining, %d cook session(s) removed, %d recipe view(s) removed, %d timing submission(s) removed.',
            $deleted,
            $recipesAfter,
            $stepsAfter,
            $sessionsRemoved,
            $viewsRemoved,
            $timingRemoved,
        ));

        // The FTS index is contentless and trigger-less: rebuild it, then
        // drop any cached recipe listings.
        $this->call('recipereal:rebuild-search');
        $this->call('cache:clear');

        return self::SUCCESS;
    }

    /**
     * Read all keep files, returning [sorted distinct keep ids minus junk,
     * junk id count, malformed line count].
     *
     * @param  list<string>  $files
     * @return array{0: list<int>, 1: int, 2: int}
     */
    private function readKeepSet(array $files): array
    {
        $keep = [];
        $junk = [];
        $malformed = 0;

        foreach ($files as $file) {
            $stream = $this->openFile($file);
            if ($stream === null) {
                continue; // already errored; the MIN_KEEP guard will refuse
            }

            $ids = 0;
            $junkIds = 0;
            while (($line = fgets($stream)) !== false) {
                if (trim($line) === '') {
                    continue;
                }

                $record = json_decode($line, true);
                if (! is_array($record) || ! is_numeric($record['id'] ?? null)) {
                    $malformed++;
                    continue;
                }

                $id = (int) $record['id'];
                if (! empty($record['junk'])) {
                    $junk[$id] = true;
                    $junkIds++;
                } else {
                    $keep[$id] = true;
                }
                $ids++;
            }
            fclose($stream);

            $this->line(sprintf('  %s: %d id(s), %d junk-flagged', basename($file), $ids, $junkIds));
        }

        // Junk recipes are to be deleted, never kept.
        $keep = array_keys(array_diff_key($keep, $junk));
        sort($keep);

        return [$keep, count($junk), $malformed];
    }

    private function countTable(string $table): int
    {
        return (int) DB::table($table)->count();
    }

    /**
     * Count rows of $table whose $column recipe (or step) owner is outside
     * the keep set — i.e. what the FK cascade will remove.
     */
    private function countOrphans(string $table, string $column, ?string $viaTable = null, ?string $viaColumn = null): int
    {
        if ($viaTable !== null) {
            return (int) DB::selectOne("SELECT COUNT(*) AS c FROM {$table} t WHERE NOT EXISTS (
                SELECT 1 FROM keep_ids k
                JOIN {$viaTable} v ON v.{$viaColumn} = k.id
                WHERE v.id = t.{$column}
            )")->c;
        }

        return (int) DB::selectOne("SELECT COUNT(*) AS c FROM {$table} t WHERE NOT EXISTS (
            SELECT 1 FROM keep_ids k WHERE k.id = t.{$column}
        )")->c;
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
