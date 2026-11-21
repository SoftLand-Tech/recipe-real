<?php

namespace App\Console\Commands;

use App\Models\RecipeDuplicatePair;
use App\Models\RecipeFingerprint;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

/**
 * Batch-walks the fingerprint table and flags CLUSTERS of recipes that
 * share a fingerprint-table hash column (slice 6 ops — see
 * docs/recipe-dedup.md):
 *
 *   - --field ∈ identity_signature (default) | main_ingredient_hash |
 *     ingredient_combo_hash | title_signature | fingerprint — the exact
 *     `fingerprint` column is included for completeness (its UNIQUE index
 *     makes clusters impossible; a same-content pair is flagged by the
 *     backfill/indexing collision path instead).
 *   - The walk NEVER scans a full table into memory: it moves an
 *     id-cursor over recipe_fingerprints in --chunk windows; a cluster can
 *     only be detected inside one window (the default 50000 makes that a
 *     non-issue in practice — note for the ops doc).
 *   - For every NON-singleton group the YOUNGEST recipe (recipe_id) gets a
 *     recipe_duplicate_pairs row pointing at the OLDEST (lowest recipe_id,
 *     the stable choice); UNIQUE (recipe_id, duplicate_of_recipe_id) makes
 *     re-runs idempotent (updateOrCreate). Cosmetic exceptions: a single
 *     recipe may appear in several overlapping clusters of different
 *     fields — that is by design (each field is an independent signal).
 *   - NOTHING is deleted or rewritten on recipes; the scan only counts and
 *     flags. Embedding/vector state untouched.
 */
final class DedupScanCommand extends Command
{
    protected $signature = 'recipereal:dedup-scan {--chunk=50000} {--field=identity_signature}';

    protected $description = 'Scan fingerprint clusters (shared hashes) and flag duplicate pairs for review.';

    private const FIELDS = ['identity_signature', 'main_ingredient_hash', 'ingredient_combo_hash', 'title_signature', 'fingerprint'];

    public function handle(): int
    {
        $field = (string) $this->option('field');

        if (! in_array($field, self::FIELDS, true)) {
            $this->error('Unknown --field "'.$field.'". Allowed: '.implode(', ', self::FIELDS).'.');

            return self::FAILURE;
        }

        $chunkSize = max(1, (int) $this->option('chunk', 50000));

        $this->info(sprintf(
            'Scanning recipe_fingerprints for clusters on "%s" (%d rows per id-window)...',
            $field,
            $chunkSize,
        ));

        $cursor = 0;
        $clusters = 0;
        $pairsWritten = 0;
        $chunks = 0;

        while (true) {
            $rows = RecipeFingerprint::query()
                ->where('id', '>', $cursor)
                ->whereNotNull($field)
                ->where($field, '!=', '')
                ->orderBy('id')
                ->limit($chunkSize)
                ->get(['id', 'recipe_id', $field]);

            if ($rows->isEmpty()) {
                break;
            }

            $cursor = (int) $rows->last()->id;
            $chunks++;

            foreach (self::nonSingletonGroups($rows, $field) as $group) {
                $clusters++;

                // Stable canonical choice: the OLDEST recipe (lowest id) is
                // the duplicate_of anchor; every other member pairs to it.
                /** @var RecipeFingerprint $oldest */
                $oldest = $group->sortBy('recipe_id')->first();

                /** @var RecipeFingerprint $member */
                foreach ($group as $member) {
                    if ((int) $member->recipe_id === (int) $oldest->recipe_id) {
                        continue;
                    }

                    RecipeDuplicatePair::query()->updateOrCreate(
                        [
                            'recipe_id' => (int) $member->recipe_id,
                            'duplicate_of_recipe_id' => (int) $oldest->recipe_id,
                        ],
                        [
                            'source' => 'engine',
                            'status' => RecipeDuplicatePair::STATUS_FLAGGED,
                            'note' => 'scan '.$field,
                        ],
                    );

                    $pairsWritten++;
                }
            }
        }

        $this->info(sprintf(
            'Scan done (%d windows): %d non-singleton "%s" cluster(s) reviewed, %d flagged pair row(s) written (existing ones untouched).',
            $chunks,
            $clusters,
            $field,
            $pairsWritten,
        ));

        return self::SUCCESS;
    }

    /**
     * The display groups inside one id-window: hash value => rows with that
     * value, only groups with 2+ members. Window size bounds the memory.
     *
     * @param  Collection<int, RecipeFingerprint>  $rows
     * @return Collection<int, Collection<int, RecipeFingerprint>>
     */
    private static function nonSingletonGroups(Collection $rows, string $field): Collection
    {
        return $rows
            ->groupBy(fn (RecipeFingerprint $row): string => (string) $row->{$field})
            ->filter(fn (Collection $group): bool => $group->count() > 1);
    }
}
