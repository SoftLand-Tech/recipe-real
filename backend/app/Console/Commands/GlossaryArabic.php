<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Support\ArabicFoodGlossary;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * One-off repair: applies ArabicFoodGlossary to every existing _ar field
 * (recipe title_ar / ingredients_ar / steps_ar + recipe_steps
 * description_ar). Raw machine translation transliterates common food words
 * ("Cranberry Scones" → "سكون الكرانبيري"); this rewrites them to their
 * established culinary terms ("سكونز التوت البري").
 *
 * DRY-RUN BY DEFAULT — pass --apply to write. Prints every diff (or up to
 * --show) plus per-rule hit counts. Safe to re-run: the glossary is
 * idempotent, so a second run reports zero changes.
 *
 * After --apply, reindex Typesense (it stores title_ar):
 *   php artisan recipereal:reindex-typesense
 * The SQLite FTS index only covers English columns — no rebuild needed.
 * Cached share pages expire on their own TTL (5 min).
 */
class GlossaryArabic extends Command
{
    protected $signature = 'recipereal:glossary-ar
        {--apply : Write the fixes (default is a dry-run report)}
        {--limit= : Max recipes to process}
        {--show=15 : Max sample diffs to print in dry-run}';

    protected $description = 'Apply the Arabic food glossary to existing _ar fields (dry-run by default).';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $limit = (int) ($this->option('limit') ?: 0);
        $show = max(0, (int) ($this->option('show') ?: 0));

        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info($apply ? 'Applying Arabic food glossary...' : 'Dry-run — no writes (pass --apply to write).');

        $ruleHits = [];
        $recipesChanged = $stepsChanged = $scanned = 0;
        $shown = 0;

        $showDiff = function (string $label, ?string $old, ?string $new) use (&$shown, $show): void {
            if ($shown >= $show || $old === $new) {
                return;
            }
            $shown++;
            $this->line("  {$label}");
            $this->line('    <fg=red>- '.mb_strimwidth((string) $old, 0, 110, '…').'</>');
            $this->line('    <fg=green>+ '.mb_strimwidth((string) $new, 0, 110, '…').'</>');
        };

        $recordHits = function (array $hits) use (&$ruleHits): void {
            foreach ($hits as $rule => $count) {
                $ruleHits[$rule] = ($ruleHits[$rule] ?? 0) + $count;
            }
        };

        Recipe::query()->orderBy('id')->chunkById(500, function ($recipes) use (
            $apply, $limit, &$scanned, &$recipesChanged, &$stepsChanged, $showDiff, $recordHits,
        ): bool {
            foreach ($recipes as $recipe) {
                $scanned++;
                if ($limit > 0 && $scanned > $limit) {
                    return false;
                }

                [$titleAr, $titleHits] = ArabicFoodGlossary::applyWithHits((string) ($recipe->title_ar ?? ''));
                $recordHits($titleHits);

                $ingredientsAr = $this->mapJsonField($recipe->ingredients_ar, $recordHits);
                $stepsAr = $this->mapJsonField($recipe->steps_ar, $recordHits);

                $stepUpdates = [];
                foreach ($recipe->recipeSteps as $step) {
                    if ($step->description_ar === null) {
                        continue;
                    }
                    [$fixed, $hits] = ArabicFoodGlossary::applyWithHits($step->description_ar);
                    $recordHits($hits);
                    if ($fixed !== $step->description_ar) {
                        $stepUpdates[$step->id] = $fixed;
                    }
                }

                $titleChanged = $titleAr !== (string) ($recipe->title_ar ?? '');
                if (! $titleChanged && $ingredientsAr === null && $stepsAr === null && $stepUpdates === []) {
                    continue;
                }

                $recipesChanged++;
                $showDiff("#{$recipe->id} {$recipe->title}", $recipe->title_ar, $titleAr);

                if (! $apply) {
                    continue;
                }

                DB::transaction(function () use ($recipe, $titleAr, $titleChanged, $ingredientsAr, $stepsAr, $stepUpdates, &$stepsChanged): void {
                    $fill = [];
                    if ($titleChanged) {
                        $fill['title_ar'] = $titleAr;
                    }
                    if ($ingredientsAr !== null) {
                        $fill['ingredients_ar'] = $ingredientsAr;
                    }
                    if ($stepsAr !== null) {
                        $fill['steps_ar'] = $stepsAr;
                    }
                    if ($fill !== []) {
                        $recipe->forceFill($fill)->save();
                    }
                    foreach ($stepUpdates as $id => $descriptionAr) {
                        DB::table('recipe_steps')->where('id', $id)->update(['description_ar' => $descriptionAr]);
                        $stepsChanged++;
                    }
                });
            }

            if ($scanned % 5000 === 0) {
                $this->info("  scanned {$scanned}...");
            }

            return true;
        });

        $this->info(sprintf(
            'Scanned %d recipes: %d would change%s.',
            $scanned,
            $recipesChanged,
            $apply ? " ({$stepsChanged} step descriptions updated)" : '',
        ));
        foreach ($ruleHits as $rule => $count) {
            $this->line(sprintf('  %-14s %s hit(s)', $rule, number_format($count)));
        }
        if (! $apply && $recipesChanged > 0) {
            $this->info('Re-run with --apply to write these fixes, then: php artisan recipereal:reindex-typesense');
        }

        return self::SUCCESS;
    }

    /**
     * Map a raw JSON _ar column (or null) through the glossary. Returns the
     * re-encoded column, or null when nothing changed / undecodable.
     */
    private function mapJsonField(mixed $raw, callable $recordHits): ?string
    {
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }
        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        if (! is_array($decoded)) {
            return null;
        }

        $changed = false;
        $mapped = $this->mapLeaves($decoded, $recordHits, $changed);
        if (! $changed) {
            return null;
        }

        return json_encode($mapped, JSON_UNESCAPED_UNICODE);
    }

    private function mapLeaves(mixed $data, callable $recordHits, bool &$changed): mixed
    {
        if (is_string($data)) {
            [$fixed, $hits] = ArabicFoodGlossary::applyWithHits($data);
            $recordHits($hits);
            if ($fixed !== $data) {
                $changed = true;
            }

            return $fixed;
        }
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = $this->mapLeaves($value, $recordHits, $changed);
            }
        }

        return $data;
    }
}
