<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Support\CommunityFeedCache;
use App\Support\HalalGate;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Audits the recipe library against HalalGate pork + alcohol rules.
 *
 * Scans imported/seed recipes by default (user-created recipes are gated at
 * write time; pass --include-user to audit them too). Dry-run unless --apply
 * is passed. With --apply, deletes flagged recipes in chunks with SQLite FK
 * cascades enabled, rebuilds recipes_fts, and bumps the timing cache.
 */
class AuditHalalLibrary extends Command
{
    private const CHUNK_SIZE = 500;

    private const MAX_SAMPLES = 20;

    protected $signature = 'recipereal:audit-halal
        {--include-user : Also scan user-created recipes (source_type=user); by default only imported/seed recipes are scanned}
        {--json : Output machine-readable JSON report}
        {--apply : Delete offending recipes and rebuild FTS search index (dry-run without this flag)}';

    protected $description = 'Scan the recipe library against HalalGate rules and optionally delete non-halal recipes (dry-run unless --apply).';

    public function handle(): int
    {
        $includeUser = (bool) $this->option('include-user');
        $json = (bool) $this->option('json');
        $apply = (bool) $this->option('apply');

        $query = Recipe::query()
            ->select(['id', 'title', 'title_ar', 'description', 'category', 'ingredients', 'ingredients_ar', 'steps', 'steps_ar', 'keywords'])
            ->with('recipeSteps:id,recipe_id,description,description_ar');

        if (! $includeUser) {
            $query->where(function (Builder $q): void {
                $q->whereNull('source_type')
                    ->orWhere('source_type', '!=', 'user');
            });
        }

        $scannedCount = 0;
        $flaggedCount = 0;
        /** @var array<string, int> $termsBreakdown */
        $termsBreakdown = [];
        /** @var list<int> $flaggedIds */
        $flaggedIds = [];
        /** @var list<array{id: int, title: string, terms: list<string>}> $samples */
        $samples = [];

        $query->chunkById(self::CHUNK_SIZE, function (Collection $recipes) use (
            &$scannedCount,
            &$flaggedCount,
            &$termsBreakdown,
            &$flaggedIds,
            &$samples,
        ): void {
            foreach ($recipes as $recipe) {
                $scannedCount++;
                $terms = HalalGate::scan($this->collectTexts($recipe));

                if ($terms === []) {
                    continue;
                }

                $flaggedCount++;
                $flaggedIds[] = (int) $recipe->id;

                foreach ($terms as $term) {
                    $termsBreakdown[$term] = ($termsBreakdown[$term] ?? 0) + 1;
                }

                if (count($samples) < self::MAX_SAMPLES) {
                    $samples[] = [
                        'id' => (int) $recipe->id,
                        'title' => (string) $recipe->title,
                        'terms' => $terms,
                    ];
                }
            }
        });

        ksort($termsBreakdown);
        arsort($termsBreakdown);

        if (! $json) {
            $this->renderHumanFindings($includeUser, $scannedCount, $flaggedCount, $termsBreakdown, $samples);
        }

        $deletedCount = 0;
        if ($apply && $flaggedIds !== []) {
            if (! $json) {
                $this->info("Deleting {$flaggedCount} offending recipe(s)...");
            }
            $deletedCount = $this->deleteFlagged($flaggedIds, $json);
        }

        if ($json) {
            $this->line((string) json_encode([
                'dry_run' => ! $apply,
                'include_user' => $includeUser,
                'scanned_count' => $scannedCount,
                'flagged_count' => $flaggedCount,
                'deleted_count' => $deletedCount,
                'terms_breakdown' => (object) $termsBreakdown,
                'samples' => $samples,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));

            return self::SUCCESS;
        }

        if ($flaggedCount === 0) {
            $this->info('0 offending recipes found — library is halal-clean.');
        } elseif (! $apply) {
            $this->warn("Dry run — pass --apply to delete {$flaggedCount} offending recipe(s).");
        } else {
            $this->info("Deleted {$deletedCount} offending recipe(s), rebuilt FTS search index, and bumped timing cache.");
        }

        return self::SUCCESS;
    }

    /**
     * Collect all scannable text fields from a recipe and its eager-loaded steps.
     *
     * @return list<string|null>
     */
    private function collectTexts(Recipe $recipe): array
    {
        $texts = [
            $recipe->title,
            $recipe->title_ar,
            $recipe->description,
            $recipe->category,
            $this->stringifyField($recipe->ingredients),
            $recipe->ingredients_ar,
            $this->stringifyField($recipe->steps),
            $this->stringifyField($recipe->steps_ar),
            $this->stringifyField($recipe->keywords),
        ];

        foreach ($recipe->recipeSteps as $step) {
            $texts[] = $step->description;
            $texts[] = $step->description_ar;
        }

        return $texts;
    }

    /**
     * Flatten array-cast recipe fields (ingredients, keywords) safely to text.
     */
    private function stringifyField(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            return $value;
        }

        if (is_array($value)) {
            $parts = [];
            array_walk_recursive($value, static function (mixed $item) use (&$parts): void {
                if (is_scalar($item)) {
                    $parts[] = (string) $item;
                }
            });

            return implode("\n", $parts);
        }

        return is_scalar($value) ? (string) $value : null;
    }

    /**
     * Delete offending recipes in chunked transactions, rebuild FTS, and bump timing cache.
     *
     * @param  list<int>  $flaggedIds
     */
    private function deleteFlagged(array $flaggedIds, bool $silent): int
    {
        $isSqlite = DB::connection()->getDriverName() === 'sqlite';

        if ($isSqlite) {
            DB::statement('PRAGMA busy_timeout = 60000');
            // Cascades (recipe_steps, cook_sessions, ...) only fire when FK
            // enforcement is ON — force it explicitly before deleting.
            DB::statement('PRAGMA foreign_keys = ON');
        }

        $deletedCount = 0;
        foreach (array_chunk($flaggedIds, self::CHUNK_SIZE) as $chunk) {
            DB::transaction(function () use ($chunk, &$deletedCount): void {
                $deletedCount += DB::table('recipes')->whereIn('id', $chunk)->delete();
            });
        }

        if ($isSqlite) {
            $rebuildExit = $silent
                ? $this->callSilent('recipereal:rebuild-search')
                : $this->call('recipereal:rebuild-search');
            if ($rebuildExit !== self::SUCCESS && ! $silent) {
                $this->warn('Warning: recipereal:rebuild-search exited non-zero.');
            }
        }

        Cache::forget('recipes:categories');
        CommunityFeedCache::bumpTiming();

        return $deletedCount;
    }

    /**
     * Print the human-readable scan summary, terms breakdown, and sample table.
     *
     * @param  array<string, int>  $termsBreakdown
     * @param  list<array{id: int, title: string, terms: list<string>}>  $samples
     */
    private function renderHumanFindings(
        bool $includeUser,
        int $scannedCount,
        int $flaggedCount,
        array $termsBreakdown,
        array $samples,
    ): void {
        $scope = $includeUser ? 'all recipes including user-created' : 'imported/seed recipes only';
        $this->info(sprintf(
            'Scanned %s recipe(s) (%s): %s flagged.',
            number_format($scannedCount),
            $scope,
            number_format($flaggedCount),
        ));

        if ($termsBreakdown !== []) {
            $this->line('Offending terms:');
            foreach ($termsBreakdown as $term => $count) {
                $this->line(sprintf('  %-14s %s', $term, number_format($count)));
            }
        }

        if ($samples !== []) {
            $this->line('Sample flagged recipes:');
            $this->table(
                ['ID', 'Title', 'Terms'],
                array_map(static fn (array $sample): array => [
                    $sample['id'],
                    mb_strimwidth($sample['title'], 0, 60, '…'),
                    implode(', ', $sample['terms']),
                ], $samples),
            );
        }
    }
}
