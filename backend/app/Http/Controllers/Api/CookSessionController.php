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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
     * and not re-dispatched. The recipe's community_avg_minutes is
     * recomputed inline (plain average of the last 100 sessions), the same
     * aggregate full cook sessions feed; cleanup_avg_minutes is recomputed
     * the same way, but only when this submission included cleanup_minutes.
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

        // Cheap recompute: count+avg over this recipe's sessions only.
        $avg = CookSession::query()
            ->where('recipe_id', $recipe->id)
            ->whereNotNull('total_actual_minutes')
            ->latest('id')
            ->limit(100)
            ->avg('total_actual_minutes');

        if ($avg !== null) {
            $recipe->community_avg_minutes = round((float) $avg, 2);
        }

        // Same inline recompute for the cleanup average — only when this
        // submission actually contributed a cleanup figure.
        if (($data['cleanup_minutes'] ?? null) !== null) {
            $cleanupAvg = CookSession::query()
                ->where('recipe_id', $recipe->id)
                ->whereNotNull('cleanup_minutes')
                ->latest('id')
                ->limit(100)
                ->avg('cleanup_minutes');

            if ($cleanupAvg !== null) {
                $recipe->cleanup_avg_minutes = round((float) $cleanupAvg, 2);
            }
        }

        if ($recipe->isDirty()) {
            $recipe->save();
        }

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
            ->with('recipe:id,title,community_avg_minutes')
            ->latest()
            ->paginate(15);

        return CookSessionResource::collection($sessions);
    }
}
