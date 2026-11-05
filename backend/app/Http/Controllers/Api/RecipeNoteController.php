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
use Illuminate\Support\Facades\DB;

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
     * Delete the author's own note (author-only) → 204. Route binding
     * scopes {note} by id only, so also verify it belongs to the {recipe}
     * in the path — a mismatched pair is a 403, same as non-ownership.
     */
    public function destroy(Request $request, Recipe $recipe, RecipeNote $note): JsonResponse
    {
        abort_unless(
            $note->user_id === $request->user()->id && $note->recipe_id === $recipe->id,
            403,
        );

        $note->delete();

        return response()->json(null, 204);
    }

    /**
     * Report a note (authed, feeds moderation). Idempotent through the
     * note_reports UNIQUE(note_id, user_id): the first report answers 201,
     * a repeat gets a calm 200 "already reported" instead of a duplicate
     * row or a constraint error.
     */
    public function report(Request $request, Recipe $recipe, RecipeNote $note): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        abort_unless($note->recipe_id === $recipe->id, 404);

        // insertOrIgnore leans on the unique (note, user) index — one row
        // per reporter, races included. Written via the query builder (no
        // dedicated model): this is a write-only moderation table with no
        // read path in the app.
        $inserted = DB::table('note_reports')->insertOrIgnore([
            'note_id' => $note->id,
            'user_id' => $request->user()->id,
            'reason' => $validated['reason'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if ($inserted === 0) {
            return response()->json(['ok' => true, 'message' => 'already reported'], 200);
        }

        return response()->json(['ok' => true], 201);
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
