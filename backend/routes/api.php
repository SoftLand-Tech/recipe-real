<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillingController;
use App\Http\Controllers\Api\CookSessionController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaceCalibrationController;
use App\Http\Controllers\Api\PostCommentController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\AvatarController;
use App\Http\Controllers\Api\FollowController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RecipeController;
use App\Http\Controllers\Api\RecipeNoteController;
use App\Http\Controllers\Api\RealityController;
use App\Http\Controllers\Api\UploadController;
use App\Http\Controllers\Api\UsageController;
use App\Http\Controllers\Api\UserBlockController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\UserRecipeController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

// Public auth route: the credential-taking Google endpoint sits behind the
// dedicated 'auth' limiter (5/min per email+IP, see AppServiceProvider::boot).
// Google is the only sign-in method; password auth no longer exists.
Route::middleware('throttle:auth')->group(function (): void {
    Route::post('/auth/google', [AuthController::class, 'google']);
});

// Public recipe-browsing routes (mobile-first; recipes are public in MVP).
// 240/min: the mobile client bursts on cold start (progressive seed +
// light refresh + rails + debounced search); 60/min tripped 429 loops.
Route::middleware('throttle:240,1')->group(function (): void {
    Route::get('/recipes', [RecipeController::class, 'index']);
    // Static /recipes/* sub-paths MUST come before /{recipe} to avoid route
    // shadowing (same reason /seed sits above it).
    Route::get('/recipes/search', [RecipeController::class, 'search']);
    Route::get('/recipes/categories', [RecipeController::class, 'categories']);
    Route::get('/recipes/seed', [RecipeController::class, 'seed']);
    Route::get('/recipes/{recipe}', [RecipeController::class, 'show']);

    // Community: public reads. Notes, the post feed and comment threads
    // are browsable signed-out; PostController::index resolves the sanctum
    // user from an optional bearer token for liked_by_me.
    Route::get('/recipes/{recipe}/notes', [RecipeNoteController::class, 'index']);
    Route::get('/posts', [PostController::class, 'index']);
    Route::get('/posts/{post}', [PostController::class, 'show']);
    Route::get('/posts/{post}/comments', [PostCommentController::class, 'index']);

    // Public profile + followers (auth optional for is_following).
    // whereNumber is LOAD-BEARING: without it these wildcards also match
    // the literal "me" and shadow the authed /users/me/* routes above them
    // in matching order (profile screen broke with 404 "No user 'me'").
    Route::get('/users/{user}/profile', [ProfileController::class, 'showPublic'])
        ->whereNumber('user');
    Route::get('/users/{user}/followers', [FollowController::class, 'followers'])
        ->whereNumber('user');
    Route::get('/users/{user}/following', [FollowController::class, 'following'])
        ->whereNumber('user');

    // Home-screen rails (curated, cached, light).
    Route::get('/home', HomeController::class);

    // Reality Index leaderboard: most under/over-estimated recipes
    // (cached 5 min, light RecipeResource rows).
    Route::get('/reality', RealityController::class);

    // Self-hosted product analytics: auth-optional (anonymous app_open events
    // are allowed), with a tighter throttle to limit anonymous spam.
    Route::post('/events', [AnalyticsController::class, 'store'])
        ->middleware('throttle:120,1'); // analytics: app_open fires per dev-reload; 30/min tripped 429s
});

// Protected routes.
Route::middleware(['throttle:60,1', 'auth:sanctum'])->group(function (): void {
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/user', UserController::class);

    // Account deletion (Play Store policy): removes the user, their tokens
    // and all their contributions. 204 on success.
    Route::delete('/account', AccountController::class);

    Route::post('/cook-sessions', [CookSessionController::class, 'store']);
    Route::get('/cook-sessions', [CookSessionController::class, 'index']);

    // One-tap "it actually took N minutes" contribution (no per-step
    // timings): creates a bare cook session feeding community_avg_minutes.
    Route::post('/recipes/{recipe}/quick-time', [CookSessionController::class, 'quickTime']);

    Route::get('/pace-calibrations', PaceCalibrationController::class);

    // Community platform: user-created recipes (owner-scoped writes; the
    // PATCH/DELETE ownership check lives in UserRecipeController).
    Route::post('/recipes', [UserRecipeController::class, 'store']);
    Route::patch('/recipes/{recipe}', [UserRecipeController::class, 'update']);
    Route::delete('/recipes/{recipe}', [UserRecipeController::class, 'destroy']);
    Route::get('/users/me/recipes', [UserRecipeController::class, 'mine']);

    // Own profile: public identity + contribution counts.
    Route::get('/users/me/profile', [ProfileController::class, 'show']);
    Route::patch('/users/me/profile', [ProfileController::class, 'update']);

    Route::post('/users/{user}/follow', [FollowController::class, 'store'])
        ->whereNumber('user');
    Route::delete('/users/{user}/follow', [FollowController::class, 'destroy'])
        ->whereNumber('user');

    // Community writes: notes on recipes, posts, likes, comments. All
    // halal-gated server-side (see App\Support\HalalGate).
    Route::post('/recipes/{recipe}/notes', [RecipeNoteController::class, 'store']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::post('/posts/{post}/like', [PostController::class, 'like']);
    Route::post('/posts/{post}/comments', [PostCommentController::class, 'store']);

    // Content ownership + moderation: edit/delete your own posts and
    // comments, report content (idempotent), block/unblock users. Blocked
    // authors' content is filtered out of the blocker's feeds.
    Route::patch('/posts/{post}', [PostController::class, 'update']);
    Route::delete('/posts/{post}', [PostController::class, 'destroy']);
    Route::post('/posts/{post}/report', [PostController::class, 'report']);
    Route::patch('/posts/{post}/comments/{comment}', [PostCommentController::class, 'update']);
    Route::delete('/posts/{post}/comments/{comment}', [PostCommentController::class, 'destroy']);
    Route::post('/posts/{post}/comments/{comment}/report', [PostCommentController::class, 'report']);
    Route::post('/users/{user}/block', [UserBlockController::class, 'store'])
        ->whereNumber('user');
    Route::delete('/users/{user}/block', [UserBlockController::class, 'destroy'])
        ->whereNumber('user');

    // Notification center: the signed-in user's inbox of likes/comments on
    // their posts (20/page, unread_count in meta) + mark-read (ids optional;
    // omitted = mark ALL read). Rows are created inline by the like/comment
    // endpoints above.
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read', [NotificationController::class, 'read']);
});

// Image uploads (authed, halal-safe by construction — binary images), with
// a tighter throttle than the general API: 20/min per user+IP.
Route::middleware(['throttle:20,1', 'auth:sanctum'])->group(function (): void {
    Route::post('/uploads', UploadController::class);
    Route::post('/users/me/avatar', AvatarController::class);
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
