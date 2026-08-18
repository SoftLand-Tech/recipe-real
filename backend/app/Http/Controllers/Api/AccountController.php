<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Cashier\Subscription;

class AccountController extends Controller
{
    /**
     * Delete the authenticated user's account (Play Store policy: in-app
     * account deletion). Mobile contract: deleteAccount() →
     * axios.delete('/api/account') → 204 on success.
     *
     * Lives inside the auth:sanctum protected route group so $request->user()
     * is guaranteed. Invokable to match UserController.
     */
    public function __invoke(Request $request)
    {
        $user = $request->user();

        DB::transaction(function () use ($user): void {
            // Sanctum tokens are polymorphic (no FK), so they would outlive
            // the user as orphaned rows — delete them explicitly.
            $user->tokens()->delete();

            // Cashier's subscriptions/subscription_items tables ship without
            // FK cascades, so delete them (and their items) explicitly too.
            $user->subscriptions->each(function (Subscription $subscription): void {
                $subscription->items()->delete();
                $subscription->delete();
            });

            // Deleting the row lets FK cascades clear profiles,
            // cook_sessions, timing_submissions, pace_calibrations and
            // recipe_views. Analytics events survive anonymized
            // (analytics_events.user_id is nullOnDelete) and are pruned
            // after 90 days either way.
            $user->delete();
        });

        return response()->json(null, 204);
    }
}
