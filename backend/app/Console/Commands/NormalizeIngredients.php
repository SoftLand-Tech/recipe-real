<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Stage A ingredient normalization: deterministic parsing of raw ingredient
 * lines ("1/4 cup brown sugar, packed" → qty 0.25, unit cup, item "brown
 * sugar", prep "packed") into the ingredients_structured JSON column —
 * {"v":1,"items":[{raw,qty,qty_display,unit,item,prep},...]}.
 *
 * No LLM anywhere: a fixed rule set (leading quantity, canonical unit map,
 * conservative trailing-prep list) only. Lines it cannot confidently split
 * (no qty, unitless qty like "2 self rising flour", empty, "NA") keep their
 * raw text and flag the recipe via ingredients_needs_llm for the later
 * Stage B LLM pass — the partial structure is stored anyway.
 *
 * Selection is resumable: recipes are picked WHERE ingredients_structured IS
 * NULL, quality tier first (same orderByRaw trick as TranslateArabic::
 * nextBatch — normalize what the app surfaces before the long tail), then
 * id order. Processed rows leave the pending set as soon as they are
 * written, so an interrupted run simply continues where it stopped.
 */
class NormalizeIngredients extends Command
{
    protected $signature = 'recipereal:normalize-ingredients
        {--dry-run : Parse and report samples without writing}
        {--limit= : Max recipes this run}';

    protected $description = 'Parse raw ingredient lines into structured qty/unit/item/prep JSON (Stage A, deterministic).';

    /** Recipes parsed per selection query. */
    private const BATCH = 200;

    private const PROGRESS_EVERY = 1000;

    /** Dry-run sample recipes when no --limit is given. */
    private const DRY_RUN_SAMPLE = 5;

    /**
     * Canonical unit aliases (lowercase; a trailing "." is stripped before
     * lookup). Single-letter "T"/"t" are cased and handled separately.
     * Size words (large/medium/small) are deliberately absent — they stay
     * part of the item, per the Stage A rules.
     */
    private const UNIT_ALIASES = [
        'cup' => 'cup', 'cups' => 'cup', 'c' => 'cup',
        'tablespoon' => 'tablespoon', 'tablespoons' => 'tablespoon', 'tbsp' => 'tablespoon', 'tbs' => 'tablespoon',
        'teaspoon' => 'teaspoon', 'teaspoons' => 'teaspoon', 'tsp' => 'teaspoon',
        'ounce' => 'ounce', 'ounces' => 'ounce', 'oz' => 'ounce',
        'pound' => 'pound', 'pounds' => 'pound', 'lb' => 'pound', 'lbs' => 'pound',
        'gram' => 'gram', 'grams' => 'gram', 'g' => 'gram',
        'kilogram' => 'kilogram', 'kilograms' => 'kilogram', 'kg' => 'kilogram',
        'ml' => 'ml',
        'liter' => 'liter', 'liters' => 'liter', 'litre' => 'liter', 'litres' => 'liter', 'l' => 'liter',
        'quart' => 'quart', 'quarts' => 'quart',
        'pint' => 'pint', 'pints' => 'pint',
        'gallon' => 'gallon', 'gallons' => 'gallon',
        'clove' => 'clove', 'cloves' => 'clove',
        'can' => 'can', 'cans' => 'can',
        'package' => 'package', 'packages' => 'package', 'pkg' => 'package',
        'envelope' => 'envelope', 'envelopes' => 'envelope',
        'box' => 'box', 'boxes' => 'box',
        'jar' => 'jar', 'jars' => 'jar',
        'stick' => 'stick', 'sticks' => 'stick',
        'pinch' => 'pinch', 'pinches' => 'pinch',
        'dash' => 'dash',
        'drop' => 'drop', 'drops' => 'drop',
        'slice' => 'slice', 'slices' => 'slice',
        'sprig' => 'sprig', 'sprigs' => 'sprig',
        'leaf' => 'leaf', 'leaves' => 'leaf',
        'stalk' => 'stalk', 'stalks' => 'stalk',
        'bunch' => 'bunch', 'bunches' => 'bunch',
        'head' => 'head', 'heads' => 'head',
        'piece' => 'piece', 'pieces' => 'piece',
        'whole' => 'whole',
    ];

    /**
     * Unicode vulgar fractions → numeric value.
     */
    private const UNICODE_FRACTIONS = [
        '½' => 0.5, '¼' => 0.25, '¾' => 0.75, '⅛' => 0.125,
        '⅜' => 0.375, '⅝' => 0.625, '⅞' => 0.875,
    ];

    /**
     * Conservative prep list: a trailing parenthetical or comma suffix is
     * only lifted into `prep` when its normalized text is in this list.
     */
    private const PREPS = [
        'chopped', 'diced', 'minced', 'sliced', 'grated', 'melted',
        'softened', 'divided', 'optional', 'peeled', 'crushed',
        'room temperature', 'thinly sliced', 'finely chopped',
        'finely diced', 'finely minced', 'julienned', 'cooked', 'rinsed',
        'drained', 'warmed', 'chilled',
    ];

    public function handle(): int
    {
        $limit = (int) ($this->option('limit') ?: 0);

        if ($this->option('dry-run')) {
            return $this->dryRun($limit);
        }

        // Bulk writes + other writers (queue worker) = sqlite
        // "database is locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $pending = Recipe::query()->whereNull('ingredients_structured')->count();
        $this->info(sprintf(
            'Normalizing ingredients for %s pending recipe(s)%s...',
            number_format($pending),
            $limit > 0 ? " (limit {$limit})" : ''
        ));

        $processed = $clean = $needsLlm = 0;
        $failedIds = [];
        $nextReport = self::PROGRESS_EVERY;
        $startedAt = microtime(true);

        while (true) {
            if ($limit > 0 && $processed >= $limit) {
                break;
            }

            $remaining = $limit > 0 ? $limit - $processed : self::BATCH;
            $batch = $this->nextBatch(min(self::BATCH, $remaining), $failedIds);
            if ($batch->isEmpty()) {
                break; // nothing pending
            }

            // Parse the whole batch first (pure, no DB) — a failing recipe
            // only skips itself and is excluded from selection so it cannot
            // loop forever.
            $writes = [];
            foreach ($batch as $recipe) {
                try {
                    $writes[$recipe->id] = $this->parseRecipe($recipe);
                } catch (Throwable $e) {
                    $failedIds[] = $recipe->id;
                    $this->warn("Recipe #{$recipe->id} failed: {$e->getMessage()}");
                }
            }

            [$flags, $writeFailed] = $this->writeBatch($writes);
            $failedIds = [...$failedIds, ...$writeFailed];

            foreach ($flags as $flag) {
                $processed++;
                $flag ? $needsLlm++ : $clean++;
            }

            if ($processed >= $nextReport) {
                $this->info(sprintf('  %d done — %d clean, %d needs-llm', $processed, $clean, $needsLlm));
                $nextReport += self::PROGRESS_EVERY;
            }
        }

        $seconds = max(0.001, microtime(true) - $startedAt);
        $reason = $limit > 0 && $processed >= $limit ? ' (recipe limit reached)'
            : ($failedIds !== [] ? sprintf(' (%d recipe(s) failed)', count($failedIds)) : ' (no pending recipes left)');
        $this->info(sprintf(
            'Done: %d processed, %d parsed-clean, %d needs-llm%s in %.1fs (%.0f recipe(s)/s).',
            $processed,
            $clean,
            $needsLlm,
            $reason,
            $seconds,
            $processed / $seconds,
        ));

        return self::SUCCESS;
    }

    /**
     * Report pending counts (total + quality tier) and preview the parser on
     * the next few recipes without touching the database.
     */
    private function dryRun(int $limit): int
    {
        $pending = Recipe::query()->whereNull('ingredients_structured')->count();
        $tierPending = Recipe::query()
            ->whereNull('ingredients_structured')
            ->whereRaw('(steps_count >= 2 AND image_url IS NOT NULL AND aggregated_rating >= 4 AND review_count >= 5)')
            ->count();

        $this->info("Pending recipes: {$pending} ({$tierPending} quality-tier).");
        $this->info('Parser preview on the next '.($limit > 0 ? $limit : self::DRY_RUN_SAMPLE).' (quality-tier first):');

        $sample = $this->nextBatch($limit > 0 ? $limit : self::DRY_RUN_SAMPLE, []);
        foreach ($sample as $recipe) {
            $clean = true;
            $items = [];
            foreach ((array) $recipe->ingredients as $line) {
                [$item, $parsed] = $this->parseItem((string) $line);
                $items[] = $item;
                $clean = $clean && $parsed;
            }

            $this->line(sprintf(
                '  #%d %s — %s',
                $recipe->id,
                mb_strimwidth((string) $recipe->title, 0, 50, '…'),
                $clean ? 'clean' : 'needs-llm'
            ));

            foreach ($items as $item) {
                $this->line(sprintf('    %s', json_encode($item, JSON_UNESCAPED_UNICODE)));
            }
        }

        return self::SUCCESS;
    }

    /**
     * Pure parse of one recipe's ingredient lines (no DB access): returns
     * the ingredients_structured JSON payload (partial structure even when
     * some lines stay raw — those flag ingredients_needs_llm for Stage B)
     * plus the recipe-level needs-llm flag.
     *
     * @return array{json: string, needs_llm: bool}
     */
    private function parseRecipe(Recipe $recipe): array
    {
        $needsLlm = false;
        $items = [];

        foreach ((array) $recipe->ingredients as $line) {
            [$item, $parsed] = $this->parseItem((string) $line);
            $items[] = $item;

            if (! $parsed) {
                $needsLlm = true;
            }
        }

        return [
            // Raw JSON string written via the query builder (not the
            // model), matching the _ar columns' convention and the model's
            // array-cast read path.
            'json' => json_encode(['v' => 1, 'items' => $items], JSON_UNESCAPED_UNICODE),
            'needs_llm' => $needsLlm,
        ];
    }

    /**
     * Persist a batch of parsed payloads in ONE transaction (one fsync per
     * batch, not per recipe — sqlite-friendly, same pattern as
     * ImportFoodcomMeta::applyChunk). On a batch-level failure it retries
     * recipe by recipe so one bad row cannot lose the whole batch.
     *
     * @param  array<int, array{json: string, needs_llm: bool}>  $writes
     * @return array{0: list<bool>, 1: list<int>} [needs-llm flag per recipe actually written, ids that could not be written]
     */
    private function writeBatch(array $writes): array
    {
        if ($writes === []) {
            return [[], []];
        }

        try {
            $flags = DB::transaction(function () use ($writes): array {
                $written = [];
                foreach ($writes as $id => $write) {
                    DB::table('recipes')->where('id', $id)->update([
                        'ingredients_structured' => $write['json'],
                        'ingredients_needs_llm' => $write['needs_llm'],
                    ]);
                    $written[] = $write['needs_llm'];
                }

                return $written;
            });

            return [$flags, []];
        } catch (Throwable $e) {
            $this->warn('Batch transaction failed ('.$e->getMessage().') — retrying recipe by recipe.');
        }

        $written = $failed = [];
        foreach ($writes as $id => $write) {
            try {
                DB::table('recipes')->where('id', $id)->update([
                    'ingredients_structured' => $write['json'],
                    'ingredients_needs_llm' => $write['needs_llm'],
                ]);
                $written[] = $write['needs_llm'];
            } catch (Throwable $e) {
                $failed[] = $id;
                $this->warn("Recipe #{$id} write failed: {$e->getMessage()}");
            }
        }

        return [$written, $failed];
    }

    /**
     * Parse one raw ingredient line. Returns the structured item plus
     * whether the line was confidently split (qty AND unit, or an explicit
     * "to taste"); unparsed lines come back as {raw, nulls, item: raw}.
     *
     * @return array{0: array<string, mixed>, 1: bool}
     */
    private function parseItem(string $raw): array
    {
        $line = trim($raw);

        // Degenerate lines: empty or explicit placeholders.
        $upper = strtoupper($line);
        if ($line === '' || $upper === 'NA' || $upper === 'N/A') {
            return [['raw' => $raw, 'qty' => null, 'qty_display' => null, 'unit' => null, 'item' => $line, 'prep' => null], false];
        }

        $preps = [];

        // Trailing parenthetical prep ("... Pecorino Romano (optional)").
        // Parentheticals that are not in the prep list (e.g. "(for pasta
        // water)", "(10 oz)") stay part of the item.
        if (preg_match('/\s*\(([^()]+)\)\s*$/u', $line, $m) && $this->normalizePrep($m[1]) !== null) {
            $preps[] = $this->normalizePrep($m[1]);
            $line = trim(mb_substr($line, 0, mb_strlen($line) - mb_strlen($m[0])));
        }

        // Trailing comma preps ("... parsley, chopped"), innermost last.
        // Only listed preps lift off, so "to serve" or "at room temp" stay.
        while (preg_match('/,\s*([^,]+)$/u', $line, $m)) {
            $prep = $this->normalizePrep($m[1]);
            if ($prep === null) {
                break;
            }
            array_unshift($preps, $prep);
            $line = trim(mb_substr($line, 0, mb_strlen($line) - mb_strlen($m[0])));
        }

        // "to taste" → unit to_taste, qty null (per Stage A rules).
        $toTaste = false;
        if (preg_match('/(,\s*|\s+)to taste\s*$/iu', $line)) {
            $toTaste = true;
            $line = trim(preg_replace('/(,\s*|\s+)to taste\s*$/iu', '', $line));
        }

        $qty = $qtyDisplay = $unit = null;

        if (! $toTaste) {
            [$qty, $qtyDisplay, $line] = $this->extractQuantity($line);
        }

        // Optional unit right after the qty. Single-letter cooking
        // abbreviations are cased: "T" = tablespoon, "t" = teaspoon.
        if ($qty !== null && preg_match('/^([A-Za-z]+\.?)(?=\s|$)/u', $line, $m)) {
            $canonical = $this->canonicalUnit($m[1]);
            if ($canonical !== null) {
                $unit = $canonical;
                $line = ltrim(mb_substr($line, mb_strlen($m[1])));
            }
        }

        // Confidently split = explicit qty + recognized unit (or a clean
        // "to taste"). Anything else — bare names, unitless numbers like
        // "2 self rising flour" — stays raw for Stage B.
        if (! ($toTaste || ($qty !== null && $unit !== null))) {
            return [['raw' => $raw, 'qty' => null, 'qty_display' => null, 'unit' => null, 'item' => $raw, 'prep' => null], false];
        }

        if ($toTaste) {
            $unit = 'to_taste';
        }

        $item = trim(preg_replace('/\s+/u', ' ', $line) ?? $line);
        $item = trim($item, " \t.,;");

        return [[
            'raw' => $raw,
            'qty' => $qty,
            'qty_display' => $qtyDisplay,
            'unit' => $unit,
            'item' => $item,
            'prep' => $preps === [] ? null : implode(', ', $preps),
        ], true];
    }

    /**
     * Extract the leading quantity, in rule order: mixed number ("1 1/2"),
     * plain fraction ("1/2"), unicode fraction ("½", "2½"), range ("3-4" →
     * lower bound), decimal, integer. Returns [qty, qty_display, remainder];
     * qty is null when the line does not start with a number.
     *
     * @return array{0: int|float|null, 1: string|null, 2: string}
     */
    private function extractQuantity(string $line): array
    {
        // "1 1/2"
        if (preg_match('/^(\d+)\s+(\d+)\s*\/\s*(\d+)/', $line, $m) && (int) $m[3] > 0) {
            return [$this->quantityValue((int) $m[1] + (int) $m[2] / (int) $m[3]), $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        // "1/2"
        if (preg_match('/^(\d+)\s*\/\s*(\d+)/', $line, $m) && (int) $m[2] > 0) {
            return [$this->quantityValue((int) $m[1] / (int) $m[2]), $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        // "½" / "2½"
        if (preg_match('/^(\d+)?\s*([½¼¾⅛⅜⅝⅞])/u', $line, $m) && isset(self::UNICODE_FRACTIONS[$m[2]])) {
            $value = (int) ($m[1] ?? 0) + self::UNICODE_FRACTIONS[$m[2]];

            return [$this->quantityValue($value), $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        // "3-4" (or en-dash) → lower bound
        if (preg_match('/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/u', $line, $m)) {
            return [$this->quantityValue((float) $m[1]), $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        // "0.5"
        if (preg_match('/^(\d+\.\d+)/', $line, $m)) {
            return [$this->quantityValue((float) $m[1]), $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        // "2"
        if (preg_match('/^(\d+)/', $line, $m)) {
            return [(int) $m[1], $m[0], ltrim(mb_substr($line, mb_strlen($m[0])))];
        }

        return [null, null, $line];
    }

    /**
     * Canonical unit for a leading word, or null when it is not a unit.
     * "T"/"t" are the traditional cased tablespoon/teaspoon abbreviations.
     */
    private function canonicalUnit(string $token): ?string
    {
        if ($token === 'T') {
            return 'tablespoon';
        }

        if ($token === 't') {
            return 'teaspoon';
        }

        return self::UNIT_ALIASES[rtrim(mb_strtolower($token), '.')] ?? null;
    }

    /**
     * Normalize a prep candidate (lowercase, collapsed whitespace, trailing
     * punctuation stripped); null unless it is in the conservative list.
     */
    private function normalizePrep(string $candidate): ?string
    {
        $normalized = preg_replace('/\s+/u', ' ', trim(mb_strtolower($candidate))) ?? '';
        $normalized = rtrim($normalized, '.,;');

        return in_array($normalized, self::PREPS, true) ? $normalized : null;
    }

    /**
     * Collapse integral floats ("1.0") to ints for clean JSON.
     */
    private function quantityValue(int|float $value): int|float
    {
        $rounded = round((float) $value, 3);

        return $rounded == (int) $rounded ? (int) $rounded : $rounded;
    }

    /**
     * Next pending recipes: quality tier first (same orderByRaw trick as
     * TranslateArabic::nextBatch — normalize what users actually see before
     * the long tail), then id (import) order.
     *
     * @param  list<int>  $exclude
     * @return EloquentCollection<int, Recipe>
     */
    private function nextBatch(int $count, array $exclude): EloquentCollection
    {
        return Recipe::query()
            ->whereNull('ingredients_structured')
            ->when($exclude !== [], fn ($query) => $query->whereNotIn('id', $exclude))
            ->orderByRaw('(steps_count >= 2 AND image_url IS NOT NULL AND aggregated_rating >= 4 AND review_count >= 5) DESC')
            ->orderBy('id')
            ->limit(max(1, $count))
            ->get();
    }
}
