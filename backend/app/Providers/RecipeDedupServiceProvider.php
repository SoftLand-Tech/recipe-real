<?php

namespace App\Providers;

use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Embeddings\GeminiEmbeddingProvider;
use App\Services\RecipeDedup\Embeddings\NullEmbeddingProvider;
use App\Services\RecipeDedup\Embeddings\OpenAiCompatibleEmbeddingProvider;
use App\Services\RecipeDedup\Generation\OpenAiCompatibleRecipeGenerator;
use App\Services\RecipeDedup\Judge\HttpAiDuplicateJudge;
use App\Services\RecipeDedup\Vector\NullVectorStore;
use App\Services\RecipeDedup\Vector\QdrantVectorStore;
use Illuminate\Support\ServiceProvider;

/**
 * Binds the dedup engine's external-provider interfaces from
 * config('recipe_dedup'). Bindings resolve fresh per call so config
 * changes (testing) apply without a restart.
 */
class RecipeDedupServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(VectorStore::class, function ($app): VectorStore {
            $driver = (string) config('recipe_dedup.vector.driver', 'qdrant');

            return match ($driver) {
                'none' => new NullVectorStore,
                default => new QdrantVectorStore((array) config('recipe_dedup.vector.qdrant')),
            };
        });

        $this->app->bind(EmbeddingProvider::class, function ($app): EmbeddingProvider {
            $protocol = (string) config('recipe_dedup.embeddings.protocol', 'openai_compatible');
            if (! (bool) config('recipe_dedup.embeddings.enabled', true)) {
                $protocol = 'none';
            }

            return match ($protocol) {
                'none' => new NullEmbeddingProvider,
                'gemini' => new GeminiEmbeddingProvider([
                    'endpoint' => config('recipe_dedup.embeddings.endpoint'),
                    'api_key' => config('recipe_dedup.embeddings.api_key'),
                    'model' => config('recipe_dedup.embeddings.model'),
                    'dimensions' => (int) config('recipe_dedup.embeddings.dimensions', 0),
                    'timeout' => (int) config('recipe_dedup.embeddings.timeout', 30),
                    'retries' => (int) config('recipe_dedup.embeddings.retries', 2),
                ]),
                default => new OpenAiCompatibleEmbeddingProvider([
                    'endpoint' => config('recipe_dedup.embeddings.endpoint'),
                    'api_key' => config('recipe_dedup.embeddings.api_key'),
                    'model' => config('recipe_dedup.embeddings.model'),
                    'dimensions' => (int) config('recipe_dedup.embeddings.dimensions', 0),
                    'timeout' => (int) config('recipe_dedup.embeddings.timeout', 30),
                    'retries' => (int) config('recipe_dedup.embeddings.retries', 2),
                ]),
            };
        });

        $this->app->bind(AiDuplicateJudge::class, function ($app): AiDuplicateJudge {
            return new HttpAiDuplicateJudge((array) config('recipe_dedup.ai_judge'));
        });

        $this->app->bind(RecipeCandidateGenerator::class, function ($app): RecipeCandidateGenerator {
            return new OpenAiCompatibleRecipeGenerator((array) config('recipe_dedup.generation'));
        });
    }
}
