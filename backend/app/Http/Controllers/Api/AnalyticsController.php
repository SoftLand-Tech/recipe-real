<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use Closure;
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
            // Payload cap: at most 20 properties, each a scalar (string,
            // number, boolean — what the mobile client sends) whose string
            // form is at most 256 chars. max:256 measures mb_strlen for
            // non-array values, so numbers like recipe_id: 12 pass; the
            // closure rejects arrays/objects, which max would otherwise
            // size by count().
            'properties' => ['nullable', 'array', 'max:20'],
            'properties.*' => [
                fn (string $attribute, mixed $value, Closure $fail) => is_array($value)
                    ? $fail("The {$attribute} must be a string, number or boolean.")
                    : null,
                'max:256',
            ],
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
