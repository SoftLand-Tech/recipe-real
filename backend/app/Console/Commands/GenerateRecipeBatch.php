<?php

namespace App\Console\Commands;

use App\Jobs\ProcessRecipeGenerationBatch;
use App\Models\RecipeGenerationBatch;
use App\Models\User;
use App\Services\RecipeDedup\Generation\BatchGenerationService;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Console\Command;

/**
 * Create + drive an AI recipe generation batch through the dedup engine.
 *
 * Default path dispatches ProcessRecipeGenerationBatch (a queue worker
 * runs the replacement loop; --sync exists for ops runs and tests that
 * want the outcome printed inline).
 *
 * Exit codes: 0 when the batch COMPLETED (or the queue dispatch was
 * accepted), 1 when a --sync batch ended exhausted/failed or could not
 * even claim its lease — scripted around the semantics the ops slice
 * consumes.
 */
final class GenerateRecipeBatch extends Command
{
    protected $signature = 'recipereal:generate-batch
        {requested_count : How many ACCEPTED recipes the batch must reach}
        {--brief= : Freeform generation brief (default: "generate new recipes" + cuisine/category)}
        {--cuisine= : Cuisine hint for prompts and detection}
        {--dish-family= : Dish-family hint for prompts and detection}
        {--category= : Platform category hint}
        {--language=en : Output language for generated recipes}
        {--batch-size= : Recipes per generator call (default: config recipe_dedup.generation.batch_size)}
        {--max-attempt-multiplier= : Attempt multiplier override (default: config default_max_attempt_multiplier)}
        {--sync : Run the batch inline instead of dispatching a queue job}';

    protected $description = 'Create and run an AI recipe generation batch through the dedup engine.';

    public function handle(): int
    {
        $requested = (int) $this->argument('requested_count');

        if ($requested < 1) {
            $this->error('requested_count must be a positive integer.');

            return self::FAILURE;
        }

        $owner = $this->resolveOwner();

        $batch = RecipeGenerationBatch::create([
            'requested_count' => $requested,
            'cuisine' => $this->filled('cuisine') ? (string) $this->option('cuisine') : null,
            'dish_family' => $this->filled('dish-family') ? (string) $this->option('dish-family') : null,
            'category' => $this->filled('category') ? (string) $this->option('category') : null,
            // Per-batch knobs ride in params (no columns needed): the
            // batch service reads batch_size / max_attempt_multiplier from
            // here before falling back to config defaults. owner_id is
            // devolved to the generation flow via request meta (the batch
            // table itself has no owner column).
            'params' => array_filter([
                'brief' => $this->filled('brief') ? (string) $this->option('brief') : null,
                'language' => (string) $this->option('language'),
                'batch_size' => $this->filled('batch-size') ? max(1, (int) $this->option('batch-size')) : null,
                'max_attempt_multiplier' => $this->filled('max-attempt-multiplier')
                    ? max(1.0, (float) $this->option('max-attempt-multiplier'))
                    : null,
                'owner_id' => $owner?->id,
            ], fn ($value): bool => $value !== null && $value !== ''),
            'status' => RecipeGenerationBatch::STATUS_CREATED,
        ]);

        if (! (bool) $this->option('sync')) {
            ProcessRecipeGenerationBatch::dispatch($batch->id);

            $this->info(sprintf(
                'Generation batch #%d queued (target: %d accepted recipes).',
                $batch->id,
                $requested
            ));

            return self::SUCCESS;
        }

        try {
            app(BatchGenerationService::class)->run($batch);
        } catch (GenerationException $e) {
            // Held lease / refused claim: nothing was mutated beyond creation.
            $this->error($e->getMessage());

            return self::FAILURE;
        } catch (\Throwable $e) {
            // run() already marked the row failed; surface, exit 1.
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $batch = $batch->fresh() ?? $batch;

        $this->table(
            ['id', 'status', 'requested', 'accepted', 'rejected', 'failed', 'calls', 'max_calls'],
            [[
                $batch->id,
                $batch->status,
                $batch->requested_count,
                $batch->accepted_count,
                $batch->rejected_count,
                $batch->failed_count,
                $batch->generation_attempts,
                $batch->max_attempts,
            ]]
        );

        if (filled($batch->error)) {
            $this->line((string) $batch->error);
        }

        // exhausted/failed batches are surfaced as failures so wrappers
        // (cron, CI) can alarm on them.
        return $batch->status === RecipeGenerationBatch::STATUS_COMPLETED
            ? self::SUCCESS
            : self::FAILURE;
    }

    /**
     * The generated recipes' owner row: config generation.owner_email when
     * it matches a user, else the first Filament admin (config('admin.emails')
     * is this repo's admin identity list — see User::canAccessPanel), else
     * null (recipes may legally have owner_id null, like imports).
     */
    private function resolveOwner(): ?User
    {
        $email = trim((string) config('recipe_dedup.generation.owner_email', ''));

        if ($email !== '') {
            $user = User::query()->where('email', $email)->first();

            if ($user !== null) {
                return $user;
            }
        }

        $admins = collect(explode(',', (string) config('admin.emails', '')))
            ->map(fn (string $email): string => strtolower(trim($email)))
            ->filter()
            ->values();

        if ($admins->isEmpty()) {
            return null;
        }

        return User::query()
            ->whereRaw(
                'lower(email) in ('.implode(', ', array_fill(0, $admins->count(), '?')).')',
                $admins->all(),
            )
            ->orderBy('id')
            ->first();
    }
}
