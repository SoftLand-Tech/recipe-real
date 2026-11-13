<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCookSessionRequest;
use App\Http\Requests\StoreQuickTimeRequest;
use App\Http\Resources\CookSessionResource;
use App\Jobs\RecalculatePaceCalibration;
use App\Models\CookSession;
use App\Models\Recipe;
use App\Models\TimingSubmission;
use App\Support\CommunityFeedCache;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class CookSessionController extends Controller
{
    /**
     * Record a completed cook session along with its per-step timing submissions.
     */
    public function store(StoreCookSessionRequest $request)
    {
        $data = $request->validated();

        $session = DB::transaction(function () use ($request, $data) {
            // Idempotency: if the client supplied a key and we already recorded a
            // session for this user with that key, return the existing one as-is
            // (HTTP 200, set below) without creating a duplicate cook session or
            // any timing submissions, and without re-dispatching the pace job.
            // This guards against dropped responses (server processed the POST,
            // client never read the 201) being retried offline.
            if ($request->filled('idempotency_key')) {
                $existing = CookSession::where('user_id', $request->user()->id)
                    ->where('idempotency_key', $request->input('idempotency_key'))
                    ->first();
                if ($existing !== null) {
                    return ['__idempotent__' => $existing];
                }
            }

            $session = CookSession::create([
                'user_id' => $request->user()->id,
                'recipe_id' => $data['recipe_id'],
                'total_actual_minutes' => $data['total_actual_minutes'],
                'cleanup_minutes' => $data['cleanup_minutes'] ?? null,
                'feedback' => $data['feedback'] ?? null,
                'idempotency_key' => $request->filled('idempotency_key')
                    ? $request->input('idempotency_key')
                    : null,
            ]);

            $sessionId = Str::uuid()->toString();

            foreach ($data['timing_submissions'] as $entry) {
                TimingSubmission::create([
                    'user_id' => $request->user()->id,
                    'recipe_step_id' => $entry['recipe_step_id'],
                    'actual_minutes' => $entry['actual_minutes'],
                    'session_id' => $sessionId,
                ]);
            }

            return $session;
        });

        // Idempotent short-circuit: return the previously-created session as a
        // 200 (not 201) and do NOT re-dispatch the pace calibration job.
        if (is_array($session) && isset($session['__idempotent__'])) {
            $existing = $session['__idempotent__'];
            $existing->load('recipe');

            return (new CookSessionResource($existing))
                ->response()
                ->setStatusCode(200);
        }

        $session->load('recipe');

        RecalculatePaceCalibration::dispatch($request->user()->id);

        // A full Cook Mode session is the strongest timing signal there is:
        // fold its total + per-step timings into the recipe's community
        // aggregates (averages, Reality Index, per-step times) so "Really
        // takes" moves on the very next read, then bust the timing caches
        // and reindex the recipe's searchable minutes. The idempotent-retry
        // path above returns early and never reaches here (no double-count).
        $this->absorbTimingWrite(
            $data['recipe_id'],
            collect($data['timing_submissions'])
                ->pluck('recipe_step_id')
                ->unique()
                ->map(fn ($id) => (int) $id)
                ->all(),
        );

        return (new CookSessionResource($session))->response()->setStatusCode(201);
    }

    /**
     * One-tap honest time contribution: record a cook session with just the
     * total minutes it actually took (no per-step timings), plus an optional
     * v2 breakdown — cleanup minutes, hands-on minutes and servings.
     *
     * Creates a CookSession with total_actual_minutes and no timing
     * submissions — the schema tolerates that (timing_submissions.session_id
     * is a client uuid with no FK to cook_sessions), and the pace
     * calibration job reads only timing submissions, so it is unaffected
     * and not re-dispatched. Guards live in StoreQuickTimeRequest: one
     * quick-time per user per recipe per 24h, plus a 5x sanity rejection
     * against reality_minutes once >= 5 real sessions exist.
     * The recipe's community aggregates follow via
     * the same absorbTimingWrite() full cook sessions feed (averages over
     * the last 100 sessions, Reality Index flipped to 'community', timing
     * caches busted, searchable minutes reindexed).
     */
    public function quickTime(StoreQuickTimeRequest $request, Recipe $recipe): JsonResponse
    {
        $data = $request->validated();
        $minutes = (float) $data['minutes'];

        CookSession::create([
            'user_id' => $request->user()->id,
            'recipe_id' => $recipe->id,
            'total_actual_minutes' => $minutes,
            'cleanup_minutes' => $data['cleanup_minutes'] ?? null,
            'hands_on_minutes' => $data['hands_on_minutes'] ?? null,
            'servings' => $data['servings'] ?? null,
            'source' => 'quick',
        ]);

        $this->absorbTimingWrite($recipe->id, [], recomputeSteps: false);

        $recipe->refresh();

        return response()->json([
            'ok' => true,
            'recipe_id' => $recipe->id,
            'minutes_submitted' => $minutes,
            'community_avg_minutes' => $recipe->community_avg_minutes !== null
                ? (float) $recipe->community_avg_minutes
                : null,
            'cleanup_avg_minutes' => $recipe->cleanup_avg_minutes !== null
                ? (float) $recipe->cleanup_avg_minutes
                : null,
        ], 201);
    }

    /**
     * Paginated cook-session history for the authed user (15/page, newest first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $sessions = CookSession::where('user_id', $request->user()->id)
            // image_url feeds the Home "Recently cooked" photo cards.
            ->with('recipe:id,title,community_avg_minutes,image_url')
            ->latest()
            ->paginate(15);

        return CookSessionResource::collection($sessions);
    }

    /**
     * Shared tail for every timing write (full Cook Mode sessions and
     * one-tap quick-time logs): fold the new data into the recipe's
     * community aggregates, bust the shared timing caches (home rails,
     * reality leaderboard, landing popular), refresh the recipe's cached
     * share pages, and reindex its searchable minutes. All best-effort past
     * the aggregate recompute — a cache/search failure must never fail a
     * cook submission.
     *
     * @param  list<int>  $stepIds  submitted step ids (totals-only writes
     *                              pass [] and heal steps that already have
     *                              submissions)
     */
    private function absorbTimingWrite(int $recipeId, array $stepIds = [], bool $recomputeSteps = true): void
    {
        $recipe = Recipe::find($recipeId);
        if ($recipe === null) {
            return;
        }

        $recipe->refreshCommunityTiming($stepIds, $recomputeSteps);

        CommunityFeedCache::bumpTiming();
        ShareCache::forgetRecipe($recipe->id);
        $this->syncSearch($recipe, 'upsert');
    }

    /**
     * Best-effort Typesense write-through for timing writes (same pattern as
     * UserRecipeController::syncSearch): the indexed `minutes` doc must
     * follow community_avg/reality the moment they move. Disabled daemon =
     * no-op; failure logs and never fails the request (nightly reindex
     * heals drift).
     */
    private function syncSearch(?Recipe $recipe, string $op): void
    {
        try {
            $typesense = app(TypesenseSearch::class);

            if (! $typesense->enabled() || $recipe === null) {
                return;
            }

            if ($op === 'delete') {
                $typesense->deleteDoc((string) $recipe->id);

                return;
            }

            $fresh = $recipe->fresh();
            if ($fresh === null) {
                return;
            }

            $typesense->upsertDocs([$typesense->documentFor($fresh)]);
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => $op,
                'recipe_id' => $recipe?->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
