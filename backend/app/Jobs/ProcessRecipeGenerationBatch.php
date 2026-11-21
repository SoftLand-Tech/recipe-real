<?php

namespace App\Jobs;

use App\Models\RecipeGenerationBatch;
use App\Services\RecipeDedup\Generation\BatchGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Queued driver for one recipe generation batch. The batch service is
 * idempotent and resumable (lease + DB counters), so the job runs with
 * $tries = 1: a retry would duplicate a run() the expired lease already
 * lets the NEXT dispatch claim from a clean state.
 *
 * Queue: the DEFAULT queue. config('recipe_dedup') exposes no
 * generation.queue key (only backfill/indexing queues exist), and the
 * indexing queue's purpose (embedding/vector work during publishing) is
 * unrelated — long-running generator calls stay separated from both by
 * their dedicated workers being free to pick the default lane.
 */
final class ProcessRecipeGenerationBatch implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public int $timeout;

    public function __construct(public readonly int $batchId)
    {
        // One run() must never be killed mid-flight by the worker timeout:
        // give the wall cap room to terminate the loop first.
        $this->timeout = max(
            300,
            (int) config('recipe_dedup.generation.max_wall_seconds', 3600) + 60,
        );
    }

    public function handle(BatchGenerationService $service): void
    {
        $batch = RecipeGenerationBatch::query()->findOrFail($this->batchId);

        $service->run($batch);
    }

    public function failed(Throwable $exception): void
    {
        Log::error('Recipe generation batch job failed.', [
            'batch_id' => $this->batchId,
            'exception' => $exception->getMessage(),
        ]);
    }
}
