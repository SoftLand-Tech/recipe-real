<?php

namespace App\Console\Commands;

use App\Services\RecipeDedup\Contracts\VectorStore;
use Illuminate\Console\Command;
use Throwable;

/**
 * Diagnoses the vector store from the command line (slice 6 ops — see
 * docs/recipe-dedup.md). Uses ONLY the frozen VectorStore contract
 * (enabled()/ping()/collection()) — no Qdrant HTTP of its own, so it works
 * for every current and future driver. Unreachable stores are reported
 * gracefully with exit 1, never via an uncaught exception.
 */
final class DedupCheckVectorCommand extends Command
{
    protected $signature = 'recipereal:dedup-check-vector';

    protected $description = 'Check the vector store: driver, enabled, collection, ping (exit 1 when unreachable).';

    public function handle(VectorStore $store): int
    {
        if (! $store->enabled()) {
            $this->info('Vector store: DISABLED (driver '.config('recipe_dedup.vector.driver').').');
            $this->line('The engine still works on exact fingerprints + signature lookups; enable a driver via DEDUP_VECTOR_DRIVER.');

            return self::SUCCESS;
        }

        try {
            $healthy = $store->ping();
        } catch (Throwable $e) {
            $this->error(sprintf(
                'Vector store UNREACHABLE: %s',
                $e->getMessage(),
            ));
            $this->line(sprintf(
                'url=%s collection=%s — check DEDUP_QDRANT_URL / DEDUP_QDRANT_API_KEY and whether the daemon is listening.',
                (string) config('recipe_dedup.vector.qdrant.url'),
                $store->collection(),
            ));

            return self::FAILURE;
        }

        if (! $healthy) {
            $this->error('Vector store unreachable: ping returned false (no exception, driver reported failure).');
            $this->line(sprintf(
                'url=%s collection=%s — check DEDUP_QDRANT_URL / DEDUP_QDRANT_API_KEY and whether the daemon is listening.',
                (string) config('recipe_dedup.vector.qdrant.url'),
                $store->collection(),
            ));

            return self::FAILURE;
        }

        $this->info('Vector store: OK — reachable.');
        $this->line(sprintf('driver=%s collection=%s', (string) config('recipe_dedup.vector.driver'), $store->collection()));
        $this->line('hint: point counts / health details live in the vector DB itself (Qdrant: GET /collections/{name});'
            .' the store contract exposes enabled/ping/collection only.');

        return self::SUCCESS;
    }
}
