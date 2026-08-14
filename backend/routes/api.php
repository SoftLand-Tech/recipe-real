<?php

use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CookSessionController;
use App\Http\Controllers\Api\PaceCalibrationController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\UsageController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

// Public auth route: the credential-taking Google endpoint sits behind the
// dedicated 'auth' limiter (5/min per email+IP, see AppServiceProvider::boot).
// Google is the only sign-in method; password auth no longer exists.
Route::middleware('throttle:auth')->group(function (): void {
    Route::post('/auth/google', [AuthController::class, 'google']);
});

// Public recipe-browsing routes (mobile-first; recipes are public in MVP).
Route::middleware('throttle:60,1')->group(function (): void {
    Route::get('/recipes', [RecipeController::class, 'index']);
    // /seed MUST come before /{recipe} to avoid route shadowing.
    Route::get('/recipes/seed', [RecipeController::class, 'seed']);
    Route::get('/recipes/{recipe}', [RecipeController::class, 'show']);

    // Self-hosted product analytics: auth-optional (anonymous app_open events
    // are allowed), with a tighter throttle to limit anonymous spam.
    Route::post('/events', [AnalyticsController::class, 'store'])
        ->middleware('throttle:30,1');
});

// Protected routes.
Route::middleware(['throttle:60,1', 'auth:sanctum'])->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/user', UserController::class);

    Route::post('/cook-sessions', [CookSessionController::class, 'store']);
    Route::get('/cook-sessions', [CookSessionController::class, 'index']);

    Route::get('/pace-calibrations', PaceCalibrationController::class);
});

// Protected billing + usage routes.
Route::middleware(['throttle:60,1', 'auth:sanctum'])->group(function (): void {
    Route::post('/billing/checkout', [BillingController::class, 'checkout']);
    Route::post('/billing/portal', [BillingController::class, 'portal']);
    Route::get('/usage', UsageController::class);
});

// Stripe webhook: public, no auth, no throttle group (Cashier's signature
// middleware validates the request using STRIPE_WEBHOOK_SECRET).
Route::post('/stripe/webhook', [WebhookController::class, 'handleWebhook']);
