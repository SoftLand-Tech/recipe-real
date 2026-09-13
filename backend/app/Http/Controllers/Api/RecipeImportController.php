<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateRecipeImportRequest;
use App\Http\Requests\PublishRecipeImportRequest;
use App\Http\Resources\RecipeImportResource;
use App\Http\Resources\RecipeResource;
use App\Jobs\ProcessRecipeImport;
use App\Jobs\RebuildSearchIndex as RebuildSearchIndexJob;
use App\Models\RecipeImport;use App\Services\RecipeImport\RecipeContentRejected;
use App\Services\RecipeImport\RecipeImportException;
use App\Services\RecipeImport\RecipeImportService;
use App\Services\RecipeImport\RecipeImportStorage;
use App\Services\RecipeImport\RecipePublisher;
use App\Support\TypesenseSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Log;
use Throwable;

class RecipeImportController extends Controller
{
    public function store(
        CreateRecipeImportRequest $request,
        RecipeImportService $service,
    ): RecipeImportResource {
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
    ): RecipeImportResource {
        $this->assertOwner($request, $recipeImport);

        return new RecipeImportResource($service->retry($recipeImport));
    }

    public function publish(
        PublishRecipeImportRequest $request,
        RecipeImport $recipeImport,
        RecipePublisher $publisher,
        RecipeImportStorage $storage,
    ): JsonResponse|RecipeResource {
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

    private function assertOwner(Request $request, RecipeImport $recipeImport): void
    {
        if ($recipeImport->requested_by !== $request->user()->id) {
            abort(404);
        }
    }

    private function syncSearch(\App\Models\Recipe $recipe): void
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
