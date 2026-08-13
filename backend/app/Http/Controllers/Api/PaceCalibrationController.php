<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaceCalibrationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaceCalibrationController extends Controller
{
    /**
     * Return the authed user's per-step_type pace calibrations.
     *
     * Premium-only feature: non-premium users get 402.
     */
    public function __invoke(Request $request): AnonymousResourceCollection|JsonResponse
    {
        $user = $request->user();

        if (! $user->isPremium()) {
            return response()->json([
                'message' => 'Pace calibration is a Premium feature.',
                'upgrade' => true,
            ], 402);
        }

        $calibrations = $user
            ->paceCalibrations()
            ->orderBy('step_type')
            ->get();

        return PaceCalibrationResource::collection($calibrations);
    }
}
