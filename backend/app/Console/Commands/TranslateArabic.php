<?php

namespace App\Console\Commands;

use App\Models\Recipe;
use App\Support\ArabicFoodGlossary;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Translates recipes to Arabic via the MyMemory free API
 * (https://mymemory.translated.net). Scheduled nightly after the analytics
 * prune; safe to re-run any time.
 *
 * Quota model: MyMemory's free tier allows ~50k source characters/day per
 * contact email (the `de` param). Emails from config recipereal.translate_emails
 * are rotated when the active one signals exhaustion — HTTP 429,
 * responseStatus != 200, or "MYMEMORY WARNING" / "ALL AVAILABLE FREE
 * TRANSLATIONS FOR TODAY" markers in translatedText. A "QUERY LENGTH LIMIT"
 * marker is different: it means the request exceeded the ~500-char q cap and
 * is answered by splitting the text, not by rotating.
 *
 * Selection is resumable: recipes are picked WHERE title_ar IS NULL,
 * image-bearing first (they're what the app shows), then id (import) order.
 * All _ar fields of a recipe are written in one transaction, and a recipe
 * only counts as done once title_ar is set — so an interrupted run simply
 * continues where it stopped.
 */
class TranslateArabic extends Command
{
    protected $signature = 'recipereal:translate-ar
        {--budget= : Max characters to translate this run (default: recipereal.translate_daily_budget)}
        {--limit= : Max recipes this run}
        {--dry-run : Report pending recipes and estimated characters without calling the API}';

    protected $description = 'Translate recipes (title, ingredients, steps) to Arabic via MyMemory.';

    private const API_URL = 'https://api.mymemory.translated.net/get';

    /** MyMemory caps q at ~500 chars; stay under it. */
    private const CHUNK_LIMIT = 480;

    /** Recipes fetched per selection query. */
    private const BATCH = 100;

    private const PROGRESS_EVERY = 25;

    /** Min seconds between API requests (~6/sec politeness cap). */
    private const REQUEST_INTERVAL = 0.5;

    /** @var list<string> */
    private array $emails = [];

    /** @var array<string, int> source chars translated per email this run */
    private array $charsByEmail = [];

    private int $emailIndex = 0;

    private int $charsUsed = 0;

    private int $budget = 0;

    private bool $quotaExhausted = false;

    private bool $budgetExhausted = false;

    private float $lastRequestAt = 0.0;

    /** Translation driver: 'google-free' (default) or 'mymemory'. */
    private string $driver = 'google-free';

    public function handle(): int
    {
        $this->driver = (string) (config('recipereal.translate_driver') ?: 'google-free');

        $this->emails = array_values(array_filter(array_map('trim',
            explode(',', (string) config('recipereal.translate_emails'))
        )));
        if ($this->driver === 'mymemory' && $this->emails === []) {
            $this->error('No translation emails configured (recipereal.translate_emails).');

            return self::FAILURE;
        }

        $limit = (int) ($this->option('limit') ?: 0);
        $this->budget = (int) ($this->option('budget') ?: config('recipereal.translate_daily_budget'));

        if ($this->option('dry-run')) {
            return $this->dryRun($limit);
        }

        // Long write transactions + other writers (queue worker) = sqlite
        // "database is locked". Wait up to 60s instead of failing.
        if (DB::connection()->getDriverName() === 'sqlite') {
            DB::statement('PRAGMA busy_timeout = 60000');
        }

        $this->info(sprintf(
            'Translating up to %s recipe(s), budget %s chars across %d email(s)...',
            $limit > 0 ? (string) $limit : 'all',
            number_format($this->budget),
            count($this->emails),
        ));

        $translated = $skipped = 0;
        $processedIds = [];

        while (! $this->stopRequested()) {
            if ($limit > 0 && $translated + $skipped >= $limit) {
                break;
            }

            $remaining = $limit > 0 ? $limit - $translated - $skipped : self::BATCH;
            $batch = $this->nextBatch(min(self::BATCH, $remaining), $processedIds);
            if ($batch->isEmpty()) {
                break; // nothing pending
            }

            foreach ($batch as $recipe) {
                $processedIds[] = $recipe->id;

                try {
                    $this->translateRecipe($recipe) ? $translated++ : $skipped++;
                } catch (Throwable $e) {
                    // A failing recipe must never crash the run.
                    $skipped++;
                    $this->warn("Recipe #{$recipe->id} failed: {$e->getMessage()}");
                }

                if (($translated + $skipped) % self::PROGRESS_EVERY === 0) {
                    $this->info(sprintf('  %d done — %s', $translated, $this->usage()));
                }

                if ($this->stopRequested()) {
                    break;
                }
            }
        }

        $reason = $this->quotaExhausted ? 'all email quotas exhausted'
            : ($this->budgetExhausted ? 'character budget reached'
                : ($limit > 0 && $translated + $skipped >= $limit ? 'recipe limit reached' : 'no pending recipes left'));
        $this->info("Done: {$translated} translated, {$skipped} skipped ({$reason}).");
        $this->info('Characters used: '.$this->usage());

        return self::SUCCESS;
    }

    /**
     * Report pending recipes and an API-free character estimate for the
     * next N (image-bearing first).
     */
    private function dryRun(int $limit): int
    {
        $pending = Recipe::query()->whereNull('title_ar')->count();
        $pendingWithImage = Recipe::query()
            ->whereNull('title_ar')
            ->whereNotNull('image_url')
            ->count();
        $sampleSize = $limit > 0 ? $limit : 25;

        $this->info("Pending recipes: {$pending} ({$pendingWithImage} with images).");
        $this->info("Character estimate for the next {$sampleSize} (image-bearing first):");

        $total = 0;
        foreach ($this->nextBatch($sampleSize, []) as $recipe) {
            $chars = $this->estimateChars($recipe);
            $total += $chars;
            $this->line(sprintf('  #%d %s — ~%d chars', $recipe->id, mb_strimwidth($recipe->title, 0, 50, '…'), $chars));
        }

        $count = min($sampleSize, $pending);
        $avg = $count > 0 ? intdiv($total, $count) : 0;
        $this->info(sprintf('Estimated ~%s chars for %d recipe(s) (avg ~%d/recipe).', number_format($total), $count, $avg));
        if ($avg > 0 && $this->budget > 0) {
            $this->info(sprintf('The %s-char budget covers ~%d recipe(s) per run.', number_format($this->budget), intdiv($this->budget, $avg)));
        }

        return self::SUCCESS;
    }

    /**
     * Translate one recipe fully (title, ingredients, steps, every
     * recipe_steps description) and persist all _ar fields in a single
     * transaction. Returns false when the run must stop (budget/quota ran
     * out mid-recipe) — nothing is written in that case, so the next run
     * resumes at this recipe.
     */
    private function translateRecipe(Recipe $recipe): bool
    {
        $titleAr = $this->translateText($recipe->title);
        if ($titleAr === null) {
            return false;
        }

        $ingredientsAr = $this->translateList((array) $recipe->ingredients);
        if ($ingredientsAr === null) {
            return false;
        }

        $stepsAr = $this->translateList((array) $recipe->steps);
        if ($stepsAr === null) {
            return false;
        }

        $stepDescriptions = [];
        foreach ($recipe->recipeSteps as $step) {
            $translated = $this->translateText($step->description);
            if ($translated === null) {
                return false;
            }
            $stepDescriptions[$step->id] = $translated;
        }

        // Raw MT transliterates common food words ("Cranberry Scones" →
        // "سكون الكرانبيري") — normalize to established culinary terms.
        $titleAr = ArabicFoodGlossary::apply($titleAr);
        $ingredientsAr = array_map([ArabicFoodGlossary::class, 'apply'], $ingredientsAr);
        $stepsAr = array_map([ArabicFoodGlossary::class, 'apply'], $stepsAr);
        foreach ($stepDescriptions as $id => $description) {
            $stepDescriptions[$id] = ArabicFoodGlossary::apply($description);
        }

        DB::transaction(function () use ($recipe, $titleAr, $ingredientsAr, $stepsAr, $stepDescriptions): void {
            // _ar columns hold raw JSON strings (no model cast), matching how
            // the original json columns are stored.
            $recipe->forceFill([
                'title_ar' => $titleAr,
                'ingredients_ar' => $ingredientsAr === [] ? null : json_encode($ingredientsAr, JSON_UNESCAPED_UNICODE),
                'steps_ar' => $stepsAr === [] ? null : json_encode($stepsAr, JSON_UNESCAPED_UNICODE),
            ])->save();

            foreach ($stepDescriptions as $id => $descriptionAr) {
                DB::table('recipe_steps')->where('id', $id)->update(['description_ar' => $descriptionAr]);
            }
        });

        return true;
    }

    /**
     * Next pending recipes: image-bearing first, then import order. Already
     * attempted ids are excluded so a skipped recipe cannot loop forever.
     *
     * @param  list<int>  $exclude
     * @return EloquentCollection<int, Recipe>
     */
    private function nextBatch(int $count, array $exclude): EloquentCollection
    {
        return Recipe::query()
            ->whereNull('title_ar')
            ->when($exclude !== [], fn ($query) => $query->whereNotIn('id', $exclude))
            // Priority: has image first, then the quality tier (rated + loved)
            // — translate what users actually see before the long tail.
            ->orderByRaw('(image_url IS NULL) ASC')
            ->orderByRaw('(aggregated_rating >= 4 AND review_count >= 5) DESC')
            ->orderBy('id')
            ->limit(max(1, $count))
            ->with('recipeSteps')
            ->get();
    }

    /**
     * Rough source-character count for a recipe (what MyMemory bills).
     */
    private function estimateChars(Recipe $recipe): int
    {
        $chars = mb_strlen($recipe->title);
        foreach ((array) $recipe->ingredients as $ingredient) {
            $chars += mb_strlen((string) $ingredient) + 1;
        }
        foreach ((array) $recipe->steps as $step) {
            $chars += mb_strlen((string) $step) + 1;
        }
        foreach ($recipe->recipeSteps as $step) {
            $chars += mb_strlen($step->description) + 1;
        }

        return $chars;
    }

    /**
     * Translate a list of strings (ingredients / steps). Batched into a
     * single call by joining with newlines; falls back to per-item calls
     * when the API does not preserve the line count.
     *
     * @param  list<mixed>  $items
     * @return list<string>|null
     */
    private function translateList(array $items): ?array
    {
        if ($items === []) {
            return [];
        }

        $items = array_map(fn ($item) => trim((string) $item), array_values($items));

        $joined = $this->translateText(implode("\n", $items));
        if ($joined !== null) {
            $lines = array_values(array_map('trim', explode("\n", $joined)));
            if (count($lines) === count($items)) {
                return $lines;
            }
        }

        // Line mapping lost — translate one item per call.
        $out = [];
        foreach ($items as $item) {
            $translated = $this->translateText($item);
            if ($translated === null) {
                return null;
            }
            $out[] = $translated;
        }

        return $out;
    }

    /**
     * Translate one text: split into ≤480-char chunks on sentence/line
     * boundaries (the API caps q at ~500 chars) and rejoin the results.
     * Returns null when the budget or every email's quota ran out.
     */
    private function translateText(string $text): ?string
    {
        $text = trim($text);
        if ($text === '') {
            return '';
        }

        $out = [];
        foreach ($this->chunkText($text) as $chunk) {
            $translated = $this->translateChunk($chunk);
            if ($translated === null) {
                return null;
            }
            $out[] = $translated;
        }

        return implode("\n", $out);
    }

    /**
     * One API call for a ≤480-char chunk, rotating emails on quota signals.
     */
    private function translateChunk(string $q): ?string
    {
        if ($this->stopRequested()) {
            return null;
        }

        if ($this->driver === 'google-free') {
            return $this->translateChunkGoogle($q);
        }

        $tries = count($this->emails);
        while ($tries-- > 0) {
            $email = $this->emails[$this->emailIndex];
            $this->throttle();
            $this->lastRequestAt = microtime(true);

            try {
                $response = Http::timeout(3)->get(self::API_URL, [
                    'q' => $q,
                    'langpair' => 'en|ar',
                    'de' => $email,
                ]);
            } catch (Throwable $e) {
                // Connection error — let the next email try.
                $this->rotate("connection error for {$email} ({$e->getMessage()})");

                continue;
            }

            if ($response->status() === 429) {
                // MyMemory throttles by IP as well as by email — a 429 with
                // little usage on this email is a rate limit, not a spent
                // quota. Back off on the SAME email before rotating, so a
                // burst doesn't burn through the rotation and end the run.
                static $backoffs = [20, 45, 90];
                foreach ($backoffs as $i => $seconds) {
                    $this->line("  [rate] HTTP 429 for {$email} — backing off {$seconds}s (attempt ".($i + 1).'/3)');
                    sleep($seconds);
                    try {
                        $response = Http::timeout(3)->get(self::API_URL, [
                            'q' => $q,
                            'langpair' => 'en|ar',
                            'de' => $email,
                        ]);
                    } catch (Throwable $e) {
                        continue;
                    }
                    if ($response->status() !== 429) {
                        break;
                    }
                }
                if ($response->status() === 429) {
                    $this->rotate("HTTP 429 persisted for {$email} after back-offs");

                    continue;
                }
            }

            $data = (array) $response->json();
            // translatedText lives under responseData (some responses also
            // carry a top-level copy — accept either).
            $text = (string) ($data['responseData']['translatedText'] ?? $data['translatedText'] ?? '');
            $status = $data['responseStatus'] ?? null;

            if (str_contains($text, 'QUERY LENGTH LIMIT')) {
                // q exceeded the ~500-char cap (should not happen at ≤480):
                // split it, do not rotate.
                return $this->translateOversized($q);
            }

            $quotaSignal = str_contains($text, 'MYMEMORY WARNING')
                || str_contains($text, 'ALL AVAILABLE FREE TRANSLATIONS FOR TODAY')
                || ! empty($data['quotaFinished']);

            if ($quotaSignal || (int) $status !== 200 || $text === '') {
                $this->rotate($quotaSignal
                    ? "quota exhausted for {$email}"
                    : 'no translation (responseStatus '.var_export($status, true).") for {$email}");

                continue;
            }

            $this->charsByEmail[$email] = ($this->charsByEmail[$email] ?? 0) + mb_strlen($q);
            $this->charsUsed += mb_strlen($q);
            if ($this->budget > 0 && $this->charsUsed >= $this->budget) {
                $this->budgetExhausted = true;
            }

            return $text;
        }

        $this->quotaExhausted = true;

        return null;
    }

    /**
     * Defensive path for a "QUERY LENGTH LIMIT" response: split the chunk
     * in half (at a word boundary) and translate the halves separately.
     */
    /**
     * Google's keyless translate endpoint (client=gtx). Unofficial but
     * stable for years, excellent Arabic, no quota wall from datacenter IPs
     * (unlike MyMemory, which 429-blocks VPS IPs durably). Response is a
     * nested array: [[["translated segment", "source segment"], ...], ...]
     * — concatenate the first element of every segment row.
     */
    private function translateChunkGoogle(string $q): ?string
    {
        // gtx accepts ~5k chars per GET; our chunks are already small.
        $tries = 3;
        while ($tries-- > 0) {
            $this->throttle();
            $this->lastRequestAt = microtime(true);
            try {
                $response = Http::timeout(8)
                    ->withHeaders(['User-Agent' => 'Mozilla/5.0 (X11; Linux x86_64) RecipeReal/1.0'])
                    ->get('https://translate.googleapis.com/translate_a/single', [
                        'client' => 'gtx',
                        'sl' => 'en',
                        'tl' => 'ar',
                        'dt' => 't',
                        'q' => $q,
                    ]);
            } catch (Throwable $e) {
                if ($tries === 0) {
                    $this->line('  [net] google connection error: '.mb_substr($e->getMessage(), 0, 120));

                    return null;
                }
                usleep(500_000);

                continue;
            }

            if ($response->status() === 429 || $response->status() >= 500) {
                $this->line('  [rate] google HTTP '.$response->status().' — backing off 30s');
                sleep(30);

                continue;
            }
            if ($response->status() !== 200) {
                $this->line('  [net] google HTTP '.$response->status().' — giving up on this chunk');

                return null;
            }

            $data = $response->json();
            if (! is_array($data) || ! is_array($data[0] ?? null)) {
                $this->line('  [net] google unexpected payload — skipping chunk');

                return null;
            }
            $out = '';
            foreach ($data[0] as $segment) {
                $out .= (string) ($segment[0] ?? '');
            }
            $out = trim($out);
            if ($out === '') {
                return null;
            }

            $this->charsUsed += mb_strlen($q);
            if ($this->budget > 0 && $this->charsUsed >= $this->budget) {
                $this->budgetExhausted = true;
            }

            return $out;
        }

        return null;
    }

    private function translateOversized(string $q): ?string
    {
        if (mb_strlen($q) < 16) {
            return null; // cannot be split further
        }

        $cut = intdiv(mb_strlen($q), 2);
        $space = mb_strrpos(mb_substr($q, 0, $cut), ' ');
        if ($space !== false && $space > 0) {
            $head = mb_substr($q, 0, $space);
            $tail = mb_substr($q, $space + 1);
        } else {
            $head = mb_substr($q, 0, $cut);
            $tail = mb_substr($q, $cut);
        }

        $headAr = $this->translateText($head);
        if ($headAr === null) {
            return null;
        }
        $tailAr = $this->translateText($tail);
        if ($tailAr === null) {
            return null;
        }

        return $headAr."\n".$tailAr;
    }

    /**
     * Split text into ≤480-char chunks on sentence and line boundaries.
     * Oversized sentences are hard-split on word boundaries. Newlines are
     * preserved as chunk-internal separators so list translations can be
     * split back into lines.
     *
     * @return list<string>
     */
    private function chunkText(string $text): array
    {
        $pieces = preg_split('/(?<=[.!?;:])\s+|\R/u', $text) ?: [];
        $pieces = array_values(array_filter(array_map('trim', $pieces), fn ($p) => $p !== ''));

        // Hard-split pieces that are still longer than the cap.
        $atoms = [];
        foreach ($pieces as $piece) {
            while (mb_strlen($piece) > self::CHUNK_LIMIT) {
                $head = mb_substr($piece, 0, self::CHUNK_LIMIT);
                $cut = mb_strrpos($head, ' ');
                if ($cut === false || $cut < self::CHUNK_LIMIT / 2) {
                    $cut = self::CHUNK_LIMIT;
                }
                $atoms[] = mb_substr($piece, 0, $cut);
                $piece = trim(mb_substr($piece, $cut));
            }
            if ($piece !== '') {
                $atoms[] = $piece;
            }
        }

        // Greedily pack atoms into newline-separated chunks.
        $chunks = [];
        $current = '';
        foreach ($atoms as $atom) {
            if ($current === '') {
                $current = $atom;
            } elseif (mb_strlen($current) + 1 + mb_strlen($atom) <= self::CHUNK_LIMIT) {
                $current .= "\n".$atom;
            } else {
                $chunks[] = $current;
                $current = $atom;
            }
        }
        if ($current !== '') {
            $chunks[] = $current;
        }

        return $chunks;
    }

    /**
     * Switch to the next rotation email (wrapping; the caller bounds the
     * number of attempts).
     */
    private function rotate(string $reason): void
    {
        $current = $this->emails[$this->emailIndex];
        $this->emailIndex = ($this->emailIndex + 1) % count($this->emails);

        $this->line("  [quota] {$reason} → switching to {$this->emails[$this->emailIndex]}");
    }

    /**
     * Pace requests to ~2/sec — MyMemory throttles aggressive IPs (429) regardless of email quota.
     */
    private function throttle(): void
    {
        if ($this->lastRequestAt > 0.0) {
            $elapsed = microtime(true) - $this->lastRequestAt;
            if ($elapsed < self::REQUEST_INTERVAL) {
                usleep((int) ceil((self::REQUEST_INTERVAL - $elapsed) * 1_000_000));
            }
        }
    }

    private function stopRequested(): bool
    {
        return $this->quotaExhausted || $this->budgetExhausted;
    }

    /**
     * "X / budget chars (email: Y, ...)" usage line for progress + summary.
     */
    private function usage(): string
    {
        $perEmail = array_map(
            fn ($email) => "{$email}: ".number_format($this->charsByEmail[$email] ?? 0),
            $this->emails,
        );

        return sprintf('%s / %s chars (%s)', number_format($this->charsUsed), number_format($this->budget), implode(', ', $perEmail));
    }
}
