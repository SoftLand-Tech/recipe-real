<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RecipeController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Public auth + recipe-browsing routes (mobile-first; recipes are public in MVP).
Route::middleware('throttle:60,1')->group(function (): void {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/auth/reset-password', [AuthController::class, 'resetPassword']);

    Route::get('/recipes', [RecipeController::class, 'index']);
    // /seed MUST come before /{recipe} to avoid route shadowing.
    Route::get('/recipes/seed', [RecipeController::class, 'seed']);
    Route::get('/recipes/{recipe}', [RecipeController::class, 'show']);
});

// Protected routes.
Route::middleware(['throttle:60,1', 'auth:sanctum'])->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });
});
