<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCookSessionRequest;
use App\Http\Resources\CookSessionResource;
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
            $session = CookSession::create([
                'user_id' => $request->user()->id,
                'recipe_id' => $data['recipe_id'],
                'total_actual_minutes' => $data['total_actual_minutes'],
                'cleanup_minutes' => $data['cleanup_minutes'] ?? null,
                'feedback' => $data['feedback'] ?? null,
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

        $session->load('recipe');

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
