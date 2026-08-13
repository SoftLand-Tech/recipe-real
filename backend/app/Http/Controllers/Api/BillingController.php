<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillingController extends Controller
{
    /**
     * Create a Stripe Checkout Session for the requested subscription plan.
     *
     * Degrades to a 503 JSON response when Stripe is not configured, instead
     * of attempting (and failing) live API calls.
     */
    public function checkout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'plan' => ['required', Rule::in(['monthly', 'yearly'])],
        ]);

        if (! config('cashier.secret')) {
            return response()->json(['message' => 'Billing not configured'], 503);
        }

        $priceId = config('cashier.prices.'.$data['plan']);

        if (! $priceId) {
            return response()->json(['message' => 'Billing plan not configured'], 503);
        }

        $user = $request->user();
        $appUrl = rtrim((string) config('app.url'), '/');

        try {
            $session = $user->checkout([$priceId], [
                'mode' => 'subscription',
                'success_url' => $appUrl.'/?checkout=success',
                'cancel_url' => $appUrl.'/?checkout=cancelled',
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Billing not configured'], 503);
        }

        return response()->json(['url' => $session->url]);
    }

    /**
     * Return a URL to the Stripe billing portal for the authed user.
     *
     * Degrades to 503 when Stripe is unavailable.
     */
    public function portal(Request $request): JsonResponse
    {
        if (! config('cashier.secret')) {
            return response()->json(['message' => 'Billing not configured'], 503);
        }

        $user = $request->user();
        $appUrl = rtrim((string) config('app.url'), '/');

        try {
            $url = $user->billingPortalUrl($appUrl);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Billing not configured'], 503);
        }

        return response()->json(['url' => $url]);
    }
}
