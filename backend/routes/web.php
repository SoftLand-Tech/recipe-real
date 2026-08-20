<?php

use App\Models\Post;
use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;

/*
 | ---- Android App Links + Play Store smart redirect -----------------------
 | The share pages (/r, /p) are the targets of shared links. On phones with
 | the app installed AND verified App Links, Android opens the app directly
 | and the backend never sees the hit. Everyone else lands here, and Android
 | BROWSERS (not crawlers, not desktop, not iOS — no app exists there yet)
 | are redirected straight to the Play Store listing when PLAY_STORE_URL is
 | configured. Link-preview crawlers must receive the real page or WhatsApp
 | preview cards break.
 */

/** Link-preview crawlers that must always receive the real HTML page. */
if (! function_exists('sharePageCrawler')) {
    function sharePageCrawler(Request $request): bool
    {
        $ua = strtolower((string) $request->userAgent());

        return str_contains($ua, 'whatsapp')
            || str_contains($ua, 'telegram')
            || str_contains($ua, 'facebookexternalhit')
            || str_contains($ua, 'facebookbot')
            || str_contains($ua, 'twitterbot')
            || str_contains($ua, 'slackbot')
            || str_contains($ua, 'discordbot')
            || str_contains($ua, 'bot')
            || str_contains($ua, 'crawl')
            || str_contains($ua, 'preview');
    }
}

/** Android BROWSER visits (not crawlers) — the Play Store redirect audience. */
if (! function_exists('sharePageAndroidBrowser')) {
    function sharePageAndroidBrowser(Request $request): bool
    {
        if (sharePageCrawler($request)) {
            return false;
        }
        $ua = strtolower((string) $request->userAgent());

        // Every Android browser UA carries "Mozilla"; the crawler filter
        // above already removed bots, so this is a human on Android without
        // the app having intercepted the link.
        return str_contains($ua, 'android') && str_contains($ua, 'mozilla');
    }
}

/*
 | Android App Links verification (https://developers.android.com/training/
 | app-links/verify-site-associations). Serves the statement listing every
 | signing fingerprint (APP_LINKS_SHA256, comma-separated env) for the app
 | package. Android fetches this once per install; it must be served as
 | application/json with no redirect.
 */
Route::get('/.well-known/assetlinks.json', function () {
    $fingerprints = array_values(array_filter(array_map(
        'trim',
        explode(',', (string) config('recipereal.app_links_sha256', '')),
    )));

    if ($fingerprints === []) {
        // No fingerprints configured yet — an empty statement list keeps the
        // route alive for Android's periodic re-verification.
        return response()->json([]);
    }

    return response()->json([
        [
            'relation' => ['delegate_permission/common.handle_all_urls'],
            'target' => [
                'namespace' => 'android_app',
                'package_name' => config('recipereal.android_package', 'com.recipereal.app'),
                'sha256_cert_fingerprints' => $fingerprints,
            ],
        ],
    ]);
});

Route::get('/', function () {
    return view('welcome');
});

/*
 | Public web recipe page (GET /r/{recipe}): the share target behind the
 * app's Share button. A clean, warm, self-contained page (recipe image,
 | title EN + AR, the Reality badge "Recipe says X min / Really takes Y min",
 | steps count) plus full OpenGraph meta so WhatsApp/social previews render.
 | No auth, no user data. Unknown ids 404 via route model binding. The
 | rendered HTML is cached 5 minutes per recipe id (like the home rails —
 | the cache stores a plain string, which survives the app's
 | cache.serializable_classes = false restriction).
 */
Route::get('/r/{recipe}', function (Recipe $recipe, Request $request) {
    $store = trim((string) config('recipereal.play_store_url', ''));
    if ($store !== '' && sharePageAndroidBrowser($request)) {
        return redirect()->away($store, 302);
    }

    return response(Cache::remember(
        "recipe:share:{$recipe->id}",
        now()->addMinutes(5),
        fn () => view('recipe-share', ['recipe' => $recipe])->render(),
    ));
})->name('recipes.share');

/*
 | Public web post page (GET /p/{post}): the share target behind the app's
 * post Share buttons (feed card + post detail). Shows PUBLIC data only —
 * author display name/avatar, the full body,
 * up to 4 images, and the attached recipe as a small card linking to
 * /r/{recipe}. No auth, no counts, no comments. Unknown ids 404 via route
 * model binding. Rendered HTML cached 5 minutes per post id (same plain-
 * string pattern as the recipe page above).
 */
Route::get('/p/{post}', function (Post $post, Request $request) {
    $store = trim((string) config('recipereal.play_store_url', ''));
    if ($store !== '' && sharePageAndroidBrowser($request)) {
        return redirect()->away($store, 302);
    }

    $post->loadMissing(['user', 'recipe']);

    return response(Cache::remember(
        "post:share:{$post->id}",
        now()->addMinutes(5),
        fn () => view('post-share', ['post' => $post])->render(),
    ));
})->name('posts.share');

// Privacy policy (Play Store requirement): linked from the landing footer.
Route::get('/privacy', function () {
    return view('privacy');
});

/*
 | Google OAuth return endpoint (registered as an Authorized Redirect URI).
 | Google's implicit id_token flow delivers the token in the URL FRAGMENT,
 | which a server cannot read — so this is a tiny client-side trampoline:
 | it forwards everything (query + fragment) to the app's deep link
 | (recipereal:///login), handing control back to the pending auth session.
 | Registered in the Google console as https://recipe-real.softland.tech/auth/callback
 */
Route::get('/auth/callback', function () {
    return response()->view('auth-callback');
});

/*
 | Admin panel Google login ("Continue with Google" on /admin/login).
 | Uses the SAME OAuth client + id_token verification as the mobile app;
 | only emails on the ADMIN_EMAILS allowlist may enter. The callback needs
 | its own Google-console redirect URI:
 | https://recipe-real.softland.tech/admin/auth/google/callback
 */
Route::get('/admin/auth/google', [App\Http\Controllers\AdminGoogleController::class, 'redirect'])
    ->name('admin.google.redirect');
Route::get('/admin/auth/google/callback', [App\Http\Controllers\AdminGoogleController::class, 'callback'])
    ->name('admin.google.callback');
