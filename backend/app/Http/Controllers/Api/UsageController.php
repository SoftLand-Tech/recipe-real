<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RecipeView;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UsageController extends Controller
{
    /**
     * Return the authed user's free-tier usage for the current month.
     */
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $monthKey = now()->format('Y-m');

        $viewsThisMonth = RecipeView::where('user_id', $user->id)
            ->where('month_key', $monthKey)
            ->count();

        return response()->json([
            'premium' => $user->isPremium(),
            'views_this_month' => $viewsThisMonth,
            'limit' => 5,
        ]);
    }
}
