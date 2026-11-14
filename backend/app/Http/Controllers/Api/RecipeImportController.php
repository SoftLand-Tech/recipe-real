<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateRecipeImportRequest;
use App\Http\Requests\PublishRecipeImportRequest;
use App\Http\Resources\RecipeImportResource;
use App\Http\Resources\RecipeResource;
use App\Jobs\RebuildSearchIndex as RebuildSearchIndexJob;
use App\Models\Recipe;
use App\Models\RecipeImport;
use App\Models\User;
use App\Services\RecipeImport\RecipeContentRejected;
use App\Services\RecipeImport\RecipeImportException;
use App\Services\RecipeImport\RecipeImportService;
use App\Services\RecipeImport\RecipeImportStorage;
use App\Services\RecipeImport\RecipePublisher;
use App\Support\TypesenseSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class RecipeImportController extends Controller
{
    public function store(
        CreateRecipeImportRequest $request,
        RecipeImportService $service,
    ): RecipeImportResource {
        abort_unless($this->importerAllowed($request->user()), 403, 'Recipe import is not available yet.');

        return new RecipeImportResource($service->create($request->user(), $request));
    }

    /**
     * The authed user's own imports, newest first, 12/page. Lets mobile
     * surface in-flight (queued/processing), ready-for-review, and failed
     * imports after the app is closed or the inline poll times out.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $imports = RecipeImport::query()
            ->where('requested_by', $request->user()->id)
            ->latest('id')
            ->paginate(12);

        return RecipeImportResource::collection($imports);
    }

    public function show(Request $request, RecipeImport $recipeImport): RecipeImportResource
    {
        $this->assertOwner($request, $recipeImport);

        return new RecipeImportResource($recipeImport);
    }

    public function retry(
        Request $request,
        RecipeImport $recipeImport,
        RecipeImportService $service,
    ): RecipeImportResource|JsonResponse {
        abort_unless($this->importerAllowed($request->user()), 403, 'Recipe import is not available yet.');
        $this->assertOwner($request, $recipeImport);

        // Extraction jobs are expensive; cap retries per import (24h window
        // in the cache) so a flaky import cannot be re-queued forever.
        $key = 'import:retries:'.$recipeImport->id;
        if ((int) Cache::get($key, 0) >= 3) {
            return response()->json(['message' => 'Too many retries. Create a new import.'], 429);
        }
        if (Cache::get($key) === null) {
            Cache::put($key, 1, 86400);
        } else {
            Cache::increment($key, 1);
        }

        return new RecipeImportResource($service->retry($recipeImport));
    }

    public function publish(
        PublishRecipeImportRequest $request,
        RecipeImport $recipeImport,
        RecipePublisher $publisher,
        RecipeImportStorage $storage,
    ): JsonResponse|RecipeResource {
        abort_unless($this->importerAllowed($request->user()), 403, 'Recipe import is not available yet.');
        $this->assertOwner($request, $recipeImport);

        if ($recipeImport->status === 'published' && $recipeImport->recipe_id !== null) {
            return new RecipeResource($recipeImport->recipe()->with('recipeSteps')->firstOrFail());
        }

        if ($recipeImport->status !== 'ready') {
            return response()->json([
                'message' => 'This import is not ready for review.',
                'status' => $recipeImport->status,
            ], 409);
        }

        try {
            $recipe = $publisher->publish(
                $request->user(),
                $request->validated(),
                $recipeImport,
                $request->user(),
            );
        } catch (RecipeContentRejected $e) {
            return response()->json([
                'message' => 'This recipe contains disallowed ingredients or alcohol references.',
                'terms' => $e->terms,
            ], 422);
        } catch (RecipeImportException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => $e->errorCode,
            ], 409);
        }

        $storage->deleteAssets($recipeImport->source_assets ?: []);
        $recipeImport->update(['source_assets' => []]);
        RebuildSearchIndexJob::dispatch();
        $this->syncSearch($recipe);

        return (new RecipeResource($recipe->load('recipeSteps')))
            ->response()
            ->setStatusCode(201);
    }

    public function destroy(
        Request $request,
        RecipeImport $recipeImport,
        RecipeImportStorage $storage,
    ): JsonResponse {
        $this->assertOwner($request, $recipeImport);

        if ($recipeImport->status === 'published') {
            return response()->json(['message' => 'Published imports cannot be deleted here.'], 409);
        }

        $storage->deleteAssets($recipeImport->source_assets ?: []);
        $recipeImport->delete();

        return response()->json(null, 204);
    }

    /**
     * AI recipe imports are staff-only during the rollout: only emails on
     * the admin allowlist may queue, retry, or publish an import.
     */
    private function importerAllowed($user): bool
    {
        $emails = collect(explode(',', (string) config('admin.emails')))
            ->map(fn ($e) => strtolower(trim($e)))
            ->filter()
            ->all();

        return in_array(strtolower($user->email), $emails, true);
    }

    private function assertOwner(Request $request, RecipeImport $recipeImport): void
    {
        if ($recipeImport->requested_by !== $request->user()->id) {
            abort(404);
        }
    }

    private function syncSearch(Recipe $recipe): void
    {
        try {
            $typesense = app(TypesenseSearch::class);
            if ($typesense->enabled()) {
                $typesense->upsertDocs([$typesense->documentFor($recipe)]);
            }
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => 'upsert',
                'recipe_id' => $recipe->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
