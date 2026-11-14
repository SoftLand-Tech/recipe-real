<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Support\TypesenseSearch;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Builds the Typesense recipes collection from the recipes table.
 *
 * Run once after setting TYPESENSE_API_KEY (see .env.example), with --fresh
 * to drop and recreate the collection, and again after any bulk write that
 * bypasses the write-through sync (recipereal:ai-apply, recipereal:wipe-
 * unreviewed — those are deliberately NOT wired for per-row sync; a nightly
 * reindex covers them). Idempotent: upserts in id-ordered chunks of 500.
 */
class ReindexTypesense extends Command
{
    protected $signature = 'recipereal:reindex-typesense {--fresh : Drop and recreate the collection first}';

    protected $description = '(Re)index all recipes into Typesense.';

    private const CHUNK = 500;

    public function handle(TypesenseSearch $typesense): int
    {
        if (! $typesense->enabled()) {
            $this->error('Typesense is disabled (TYPESENSE_API_KEY is empty) — nothing to do.');

            return self::FAILURE;
        }

        try {
            if ($this->option('fresh')) {
                $this->info('Dropping collection '.$typesense->collection().'...');
                $typesense->dropCollection();
            }

            $this->info('Ensuring collection '.$typesense->collection().'...');
            if (! $typesense->ensureCollection()) {
                $this->error('Could not reach Typesense or create the collection — check the log, then retry.');

                return self::FAILURE;
            }

            $total = (int) DB::table('recipes')->count();
            $this->info("Indexing {$total} recipes into Typesense...");

            $indexed = 0;
            $lastId = 0;
            $started = microtime(true);

            while (true) {
                // DB table directly (no Eloquent hydration): only the fields
                // the payload builder needs, in id order for a stable cursor.
                $rows = DB::table('recipes')
                    ->select([
                        'id', 'title', 'title_ar', 'ingredients', 'ingredients_ar',
                        'category', 'keywords', 'image_url', 'steps_count',
                        'aggregated_rating', 'reality_minutes',
                        'community_avg_minutes', 'publisher_time_minutes',
                    ])
                    ->where('id', '>', $lastId)
                    ->orderBy('id')
                    ->limit(self::CHUNK)
                    ->get();

                if ($rows->isEmpty()) {
                    break;
                }

                // Cast each row through a Recipe model so documentFor() has
                // one payload shape everywhere (array casts on ingredients/
                // keywords/ingredients_ar included). setRawAttributes, NOT
                // new Recipe($row): the constructor mass-assigns through
                // $fillable, which EXCLUDES id/reality_minutes/etc — every
                // doc indexed with an empty id ("The `id` should not be
                // empty") until this was switched.
                $docs = $rows
                    ->map(fn ($row) => (new Recipe)->setRawAttributes((array) $row, true))
                    ->map(fn (Recipe $recipe) => $typesense->documentFor($recipe))
                    ->all();

                if (! $typesense->upsertDocs($docs)) {
                    $this->error("Upsert failed at recipe id {$lastId} — see log. Partial index possible.");

                    return self::FAILURE;
                }

                $indexed += count($docs);
                $lastId = (int) $rows->last()->id;

                $this->info(sprintf('  %d / %d (%.1fs)', $indexed, $total, microtime(true) - $started));
            }

            $this->info(sprintf(
                'Done: %d recipes indexed in %.1fs.',
                $indexed,
                microtime(true) - $started
            ));

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('Typesense reindex failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
