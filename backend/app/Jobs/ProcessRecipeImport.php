<?php

namespace App\Jobs;

use App\Models\RecipeImport;
use App\Services\RecipeImport\RecipeAiProviderManager;
use App\Services\RecipeImport\RecipeExtractionNormalizer;
use App\Services\RecipeImport\RecipeImportException;
use App\Services\RecipeImport\RecipeImportStorage;
use App\Services\RecipeImport\RecipeMediaResolverManager;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessRecipeImport implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout;

    public function __construct(public readonly int $importId)
    {
        $this->timeout = max(
            60,
            (int) config('recipereal.ai.providers.agy.timeout', 600) + 60,
        );
    }

    public function backoff(): array
    {
        return [30, 120];
    }

    public function handle(
        RecipeMediaResolverManager $mediaResolvers,
        RecipeAiProviderManager $providers,
        RecipeExtractionNormalizer $normalizer,
        RecipeImportStorage $storage,
    ): void {
        $import = RecipeImport::findOrFail($this->importId);

        if ($import->status === 'published') {
            return;
        }

        try {
            $import->update([
                'status' => 'processing',
                'stage' => 'resolving_media',
                'progress' => 15,
                'error_code' => null,
                'error_message' => null,
            ]);

            $source = $mediaResolvers->resolver()->resolve($import->fresh());
            $import->update([
                'source_platform' => $import->source_platform ?: ($source['platform'] ?? null),
                'stage' => 'extracting_recipe',
                'progress' => 35,
            ]);

            $provider = $providers->provider($import->provider);
            $raw = $provider->extract($import->fresh(), $source);
            $extraction = $normalizer->normalize($raw, $import->fresh());
            $draft = $extraction->toArray();

            $cover = $draft['cover_image_url'] ?? null;
            if (! is_string($cover) || trim($cover) === '') {
                $cover = $storage->promoteFirstImage(
                    $import,
                    is_array($import->source_assets) ? $import->source_assets : [],
                );
            }
            if (! is_string($cover) || trim($cover) === '') {
                $cover = $storage->promoteRemoteImage($source['thumbnail_url'] ?? null);
            }
            if ($cover !== null) {
                $draft['cover_image_url'] = $cover;
            }

            $warnings = array_values(array_unique(array_merge(
                $extraction->warnings,
                is_array($source['warnings'] ?? null) ? $source['warnings'] : [],
            )));
            $draft['warnings'] = $warnings;

            // The review screen only needs the normalized draft and promoted
            // cover. Remove private uploads as soon as extraction succeeds;
            // failed jobs remain eligible for the scheduled expiry cleanup.
            $storage->deleteAssets(is_array($import->source_assets) ? $import->source_assets : []);

            $import->update([
                'status' => 'ready',
                'stage' => 'ready_for_review',
                'progress' => 100,
                'provider' => $provider->key(),
                'provider_model' => $provider->model(),
                'draft' => $draft,
                'warnings' => $warnings,
                'confidence' => $extraction->confidence,
                'source_assets' => [],
                'processed_at' => now(),
                'error_code' => null,
                'error_message' => null,
            ]);
        } catch (RecipeImportException $e) {
            $this->markFailed($e);
            if ($e->retryable) {
                throw $e;
            }
        } catch (Throwable $e) {
            $this->markFailed(new RecipeImportException(
                'The recipe import could not be processed.',
                'import_failed',
                true,
                $e,
            ));
            throw $e;
        }
    }

    public function failed(Throwable $exception): void
    {
        $this->markFailed($exception instanceof RecipeImportException
            ? $exception
            : new RecipeImportException($exception->getMessage(), 'import_failed'));
    }

    private function markFailed(Throwable $exception): void
    {
        RecipeImport::whereKey($this->importId)->update([
            'status' => 'failed',
            'stage' => 'failed',
            'progress' => 100,
            'error_code' => $exception instanceof RecipeImportException
                ? $exception->errorCode
                : 'import_failed',
            'error_message' => mb_substr($exception->getMessage(), 0, 2000),
        ]);
    }
}
