<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    /**
     * Capture a lightweight product-analytics event.
     *
     * Auth-optional: logged-in requests attach the user id; anonymous
     * requests (e.g. app_open) are allowed and rely on the route's throttle.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            // snake_case.event names only: lowercase letters, digits,
            // underscores and dots (e.g. cook_completed, app_open,
            // recipe.favorited).
            'name' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9_\.]+$/'],
            'properties' => ['nullable', 'array'],
        ]);

        $user = $request->user('sanctum');

        AnalyticsEvent::create([
            'user_id' => $user?->id,
            'name' => $validated['name'],
            'properties' => $validated['properties'] ?? null,
        ]);

        return response()->json(null, 204);
    }
}
