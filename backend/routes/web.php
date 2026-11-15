<?php

use App\Http\Controllers\AdminGoogleController;
use App\Models\AppRelease;
use App\Models\ContactMessage;
use App\Models\Follow;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\User;
use App\Support\ShareBanner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/*
 | ---- Android App Links + smart share banner ------------------------------
 | The share pages (/r, /p, /u) are the targets of shared links. On phones
 | with the app installed AND verified App Links, Android opens the app
 | directly and the backend never sees the hit. Everyone else lands here
 | and sees the real page with a "Get the app" banner — EVERY non-crawler
 | browser, desktop included (product decision: a visitor must be told the
 | app is the way in, not silently left on the web page). The banner's
 | LINK is the only smart part (ShareBanner::bannerUrl): the Play Store
 | listing when PLAY_STORE_URL is configured, the direct APK (/download)
 | on Android browsers, else the landing page with its download badges.
 | Link-preview crawlers must receive the real page with NO banner or
 | WhatsApp preview cards break.
 */

// Share-page helpers (crawler detection + the store banner) live in
// App\Support\ShareBanner — routes are CACHED on prod (route:cache),
// and closures in a cached route file cannot call functions defined
// in web.php (they never execute at request time).

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

/*
 | ---- Direct APK distribution (no Play Store) ------------------------------
 | The admin panel's "App releases" page uploads signed builds into the
 * app_releases table; /download streams the newest one. HEAD works (curl
 * -I for size checks). 404 while no release exists yet.
 */
Route::get('/download', function () {
    $release = AppRelease::latest();

    abort_unless($release !== null, 404);

    return $release->toDownloadResponse();
})->middleware('throttle:30,1')->name('app.download');

// Per-release download from the admin table (same private-disk stream).
Route::get('/admin/app-releases/{release}/download', function (AppRelease $release) {
    $disk = Storage::disk('local');
    abort_unless($disk->exists($release->file_path), 404);

    return response()->download(
        $disk->path($release->file_path),
        "RecipeReal-{$release->version}.apk",
        ['Content-Type' => 'application/vnd.android.package-archive'],
    );
})->middleware(['auth'])->name('app.download.release');

Route::get('/', function () {
    // "Browse Popular Recipes" grid: real rows on prod (top-rated,
    // image-backed, with a claim time), cached 15 min. The view renders
    // a static preview set when this comes back empty (fresh dev DBs) —
    // prod never sees the fallback.
    $popular = Cache::remember('landing:popular', now()->addMinutes(15), function () {
        return Recipe::query()
            ->select('id', 'title', 'title_ar', 'image_url', 'publisher_time_minutes', 'reality_minutes', 'aggregated_rating')
            ->whereNotNull('image_url')
            ->where('image_url', '!=', '')
            ->where('publisher_time_minutes', '>', 0)
            ->whereNotNull('aggregated_rating')
            ->where('aggregated_rating', '>', 0)
            ->orderByDesc('aggregated_rating')
            ->orderBy('id')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'title' => $r->title,
                'title_ar' => $r->title_ar,
                'img' => $r->image_url,
                'minutes' => (int) $r->publisher_time_minutes,
                'really' => $r->reality_minutes !== null ? (int) $r->reality_minutes : null,
                'rating' => number_format((float) $r->aggregated_rating, 1),
            ])
            ->all();
    });

    // The landing's download badges adapt to whether a build exists.
    // Rendered by the Tailwind twin (welcome-tw.blade.php + welcome-tw.css,
    // built by Vite — deploy must ship backend/public/build or @vite 500s).
    return view('welcome-tw', [
        'latestRelease' => AppRelease::latest(),
        'popular' => $popular,
    ]);
});

/*
 | ---- Real content pages (every footer link is a real page) ---------------
 | Static-but-honest pages behind the landing's footer. Blog articles are
 | plain view files keyed by slug — no CMS, nothing dynamic to break.
 */
Route::view('/about', 'pages.about')->name('pages.about');
Route::view('/careers', 'pages.careers')->name('pages.careers');
Route::view('/press', 'pages.press')->name('pages.press');
Route::view('/pricing', 'pages.pricing')->name('pages.pricing');
Route::view('/tips', 'pages.tips')->name('pages.tips');
Route::view('/help', 'pages.help')->name('pages.help');
Route::view('/terms', 'pages.terms')->name('pages.terms');
Route::view('/copyright', 'pages.copyright')->name('pages.copyright');

Route::get('/blog', function () {
    return view('pages.blog');
})->name('pages.blog');

Route::get('/blog/{slug}', function (string $slug) {
    // Only the articles that actually exist resolve — everything else 404s.
    $articles = [
        'why-recipe-times-lie',
        'where-the-time-goes',
        'plan-backwards-from-maghrib',
    ];
    abort_unless(in_array($slug, $articles, true), 404);

    return view('pages.blog.'.$slug);
})->name('pages.blog.show');

Route::get('/contact', function () {
    return view('pages.contact');
})->name('pages.contact');

Route::post('/contact', function (Request $request) {
    $data = $request->validate([
        'name' => ['nullable', 'string', 'max:100'],
        'email' => ['required', 'email:rfc', 'max:200'],
        'message' => ['required', 'string', 'min:10', 'max:2000'],
    ]);

    ContactMessage::create($data);

    return redirect()->to(route('pages.contact', ['sent' => 1]).'#form');
})->middleware('throttle:6,1', 'spam')->name('pages.contact.submit');

/*
 | ---- Account deletion page + request form (store compliance) --------------
 | Third-party Android stores (APKPure, Uptodown, Samsung Galaxy Store,
 | Xiaomi GetApps, Huawei AppGallery, Amazon Appstore) all require a public
 | web URL where a user can request account deletion. The in-app path stays
 | the fast one (Settings/Profile -> Delete account -> DELETE /api/account,
 | immediate); this page serves users who cannot open the app. The form
 | NEVER deletes anything — the web has no auth and no account access — it
 | queues a ContactMessage prefixed with a clear marker so the operator can
 | verify identity manually before deleting from the admin panel. Response
 | target: within 30 days.
 */
Route::view('/account/delete', 'pages.account-delete')->name('pages.account-delete');

Route::post('/account/delete-request', function (Request $request) {
    $data = $request->validate([
        'name' => ['nullable', 'string', 'max:100'],
        'email' => ['required', 'email:rfc', 'max:200'],
        'message' => ['nullable', 'string', 'max:2000'],
    ]);

    ContactMessage::create([
        'name' => $data['name'] ?? null,
        'email' => $data['email'],
        // Marker prefix keeps deletion requests separable from ordinary
        // contact mail in the admin (Filament) queue.
        'message' => '[ACCOUNT DELETION REQUEST] '.($data['message'] ?? ''),
    ]);

    // A REAL 302 (withFragment keeps the #form anchor in the Location
    // header). String-concatenating a RedirectResponse instead returns its
    // serialized body as a 200 and loses the status/fragment.
    return redirect()->route('pages.account-delete', ['sent' => 1])->withFragment('form');
})->middleware('throttle:6,1', 'spam')->name('pages.account-delete.submit');

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
    // Facebook-style: NO hard redirect — EVERY non-crawler browser sees the
    // real page with a "Get the app" banner (rendered OUTSIDE the 5-minute
    // cache; the banner is per-visitor, the card is not).
    $bannerUrl = ShareBanner::bannerUrl($request);

    return response(str_replace(
        '</body>',
        ShareBanner::bannerHtml($request, $bannerUrl).'</body>',
        Cache::remember(
            "recipe:share:{$recipe->id}:".app()->getLocale(),
            now()->addMinutes(5),
            fn () => view('recipe-share', ['recipe' => $recipe])->render(),
        ),
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
    // Same Facebook-style banner treatment as /r above.
    $bannerUrl = ShareBanner::bannerUrl($request);

    $post->loadMissing(['user', 'recipe']);

    return response(str_replace(
        '</body>',
        ShareBanner::bannerHtml($request, $bannerUrl).'</body>',
        Cache::remember(
            "post:share:{$post->id}:".app()->getLocale(),
            now()->addMinutes(5),
            fn () => view('post-share', ['post' => $post])->render(),
        ),
    ));
})->name('posts.share');

/*
 | Public web profile page (GET /u/{user}): the share target behind the
 * app's profile Share button (the mobile app is switching from the dead
 * recipereal://user/{id} scheme to this URL in a parallel PR). PUBLIC
 * identity only — the internal users.name, email and gender never render
 * here (the API's publicOnly payload in ProfileController is the
 * allowlist): display name with the same neutral bilingual fallback,
 * avatar (a full URL or null — the view falls back to an initials tile),
 * bio, and the follower/following/recipes counts the public API exposes.
 * Up to 6 of the user's newest recipes render as small cards linking to
 * /r/{id}, so a visitor without the app keeps browsing real content.
 * Unknown ids 404 via route model binding. Rendered HTML cached 5 minutes
 * per user id per locale — same plain-string Cache::remember + str_replace
 * pattern as /r and /p above (survives cache.serializable_classes =
 * false), with the banner injected OUTSIDE the cache.
 */
Route::get('/u/{user}', function (User $user, Request $request) {
    // Same Facebook-style banner treatment as /r and /p above.
    $bannerUrl = ShareBanner::bannerUrl($request);

    return response(str_replace(
        '</body>',
        ShareBanner::bannerHtml($request, $bannerUrl).'</body>',
        Cache::remember(
            "user:share:{$user->id}:".app()->getLocale(),
            now()->addMinutes(5),
            // Counts + the recipe card rows run INSIDE the closure so they
            // only cost anything on a cache miss. Recipes use the same
            // ordering idea as the API's profile recipes endpoint
            // (ProfileController::recipes: owner filter + latest('id')),
            // trimmed to the slim card shape the view renders.
            fn () => view('user-share', [
                'user' => $user,
                'recipesCount' => (int) Recipe::query()->where('owner_id', $user->id)->count(),
                'followersCount' => (int) Follow::query()->where('followed_id', $user->id)->count(),
                'followingCount' => (int) Follow::query()->where('follower_id', $user->id)->count(),
                'recipes' => Recipe::query()
                    ->where('owner_id', $user->id)
                    ->select('id', 'title', 'title_ar', 'image_url', 'publisher_time_minutes', 'reality_minutes', 'community_avg_minutes')
                    ->latest('id')
                    ->limit(6)
                    ->get(),
            ])->render(),
        ),
    ));
})->name('users.share');

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
Route::get('/admin/auth/google', [AdminGoogleController::class, 'redirect'])
    ->name('admin.google.redirect');
Route::get('/admin/auth/google/callback', [AdminGoogleController::class, 'callback'])
    ->name('admin.google.callback');

/*
 | ---- Web app SPA (same-origin at /app) --------------------------------------
 | Serves the Vite build in public/app (deploy.sh builds web/ into it before
 | caches warm). The catch-all param plus LAST-position registration keep it
 | from shadowing /admin, /r, /p, /u, /api or any earlier route — Laravel
 | matches in registration order, and nothing above starts with /app.
 |
 | The shell's index.html carries the placeholder __GOOGLE_CLIENT_ID__ inside
 | a window.__RECIPEREAL__ assignment; it is string-replaced here from
 | config('services.google.client_id') so the client ID is deployed per
 | environment without a rebuild. Missing build (fresh clone, botched
 | deploy) returns a 503 explainer instead of a white screen, so the failure
 | is diagnosable from the browser. Asset requests under /app/assets/* are
 | served by the web server directly from public/app — only the HTML shell
 | (and its deep links) needs this route.
 */
Route::get('/app/{any?}', function () {
    $shell = public_path('app/index.html');

    if (! is_file($shell)) {
        return response(
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'.
            '<meta name="viewport" content="width=device-width, initial-scale=1">'.
            '<title>RecipeReal — web build missing</title></head>'.
            '<body style="font-family:system-ui;background:#FAF6EF;color:#26211B;'.
            'display:flex;align-items:center;justify-content:center;min-height:100vh;'.
            'margin:0"><p style="max-width:28em;padding:2em;text-align:center">'.
            'The web app build is missing. Run <code>cd web &amp;&amp; npm run build</code> '.
            '(deploy.sh does this) and reload.</p></body></html>',
            503,
            ['Content-Type' => 'text/html; charset=UTF-8'],
        );
    }

    $html = str_replace(
        '__GOOGLE_CLIENT_ID__',
        (string) (config('services.google.client_id') ?? ''),
        file_get_contents($shell),
    );

    return response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8']);
})->where('any', '.*')->name('app.spa');
