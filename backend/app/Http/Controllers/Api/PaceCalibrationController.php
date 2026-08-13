<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaceCalibrationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PaceCalibrationController extends Controller
{
    /**
     * Return the authed user's per-step_type pace calibrations.
     */
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $calibrations = $request->user()
            ->paceCalibrations()
            ->orderBy('step_type')
            ->get();

        return PaceCalibrationResource::collection($calibrations);
    }
}
