<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRecipeNoteRequest;
use App\Http\Resources\RecipeNoteResource;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Support\HalalGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Public per-recipe notes ("leave a note for the next cook").
 */
class RecipeNoteController extends Controller
{
    /**
     * Paginated notes (20/page, newest first), public read. Moderated rows
     * (is_public=false) stay hidden from the world — the Filament toggle must
     * have a real effect on what this endpoint serves.
     */
    public function index(Request $request, Recipe $recipe): AnonymousResourceCollection
    {
        $notes = RecipeNote::query()
            ->where('recipe_id', $recipe->id)
            ->where('is_public', true)
            ->with('user:id,display_name,name,avatar_url')
            ->latest('id')
            ->paginate(20);

        return RecipeNoteResource::collection($notes);
    }

    /**
     * Leave a note (authed). Halal-gated like all community text.
     */
    public function store(StoreRecipeNoteRequest $request, Recipe $recipe): JsonResponse
    {
        $body = $request->string('body')->toString();

        $this->assertHalal($body);

        $note = RecipeNote::create([
            'user_id' => $request->user()->id,
            'recipe_id' => $recipe->id,
            'body' => $body,
        ]);
        $note->load('user:id,display_name,name,avatar_url');

        return (new RecipeNoteResource($note))
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Halal gate: 422 with the offending terms (see HalalGate).
     */
    private function assertHalal(string $body): void
    {
        $terms = HalalGate::scan([$body]);

        if ($terms !== []) {
            throw new HttpResponseException(response()->json([
                'message' => 'Notes cannot contain haram ingredients or alcohol references.',
                'terms' => $terms,
            ], 422));
        }
    }
}
