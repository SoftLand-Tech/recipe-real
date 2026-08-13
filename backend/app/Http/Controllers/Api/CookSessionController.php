<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCookSessionRequest;
use App\Http\Resources\CookSessionResource;
use App\Jobs\RecalculatePaceCalibration;
use App\Models\CookSession;
use App\Models\TimingSubmission;
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
