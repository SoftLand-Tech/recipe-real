<?php

namespace App\Support;

use App\Models\AppRelease;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Share-page helpers (web routes run under route:cache — closures are
 * serialized, so these MUST live in an autoloadable class, never as
 * functions defined in routes/web.php).
 */
class ShareBanner
{
    /** Link-preview crawlers that must always receive the real HTML page. */
    public static function isCrawler(Request $request): bool
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
            || str_contains($ua, 'crawler')
            || str_contains($ua, 'spider')
            || str_contains($ua, 'slurp')
            || str_contains($ua, 'embedly')
            || str_contains($ua, 'preview');
    }

    /** Android BROWSER visits (not crawlers) — the store-banner audience. */
    public static function isAndroidBrowser(Request $request): bool
    {
        if (self::isCrawler($request)) {
            return false;
        }
        $ua = strtolower((string) $request->userAgent());

        return str_contains($ua, 'android') && str_contains($ua, 'mozilla');
    }

    /**
     * The banner link target, decided ONCE for every share page (/r, /p,
     * /u). The banner itself shows for EVERY non-crawler browser — product
     * decision: any visitor landing on a share link must be told the app
     * is the way in ("open the website with a notification that you need
     * to download the app first"). Only the destination is smart:
     *
     *   crawlers            → null (no banner: they must receive the real
     *                         page, or WhatsApp/Telegram preview cards break);
     *   PLAY_STORE_URL set  → the store listing, for every browser;
     *   Android browser     → the direct APK route (/download streams the
     *                         latest signed build — the store's stand-in
     *                         while no Play listing exists; guarded below so
     *                         a fresh deployment with no uploaded release
     *                         falls back to the landing instead of a 404);
     *   everyone else       → the landing page, which carries the download
     *                         badges (desktop/iOS cannot install an APK).
     */
    public static function bannerUrl(Request $request): ?string
    {
        if (self::isCrawler($request)) {
            return null;
        }

        $store = trim((string) config('recipereal.play_store_url', ''));
        if ($store !== '') {
            return $store;
        }

        if (self::isAndroidBrowser($request) && self::hasRelease()) {
            return route('app.download');
        }

        return url('/');
    }

    /**
     * Whether any APK release is uploaded (the /download route 404s when
     * none is). Cached 5 minutes — a banner hit is on EVERY share-page
     * request, and the release table changes only when the operator
     * publishes or (rarely) deletes a build.
     */
    private static function hasRelease(): bool
    {
        return Cache::remember('share_banner:has_release', now()->addMinutes(5), function () {
            return AppRelease::query()->exists();
        });
    }

    /**
     * Self-contained "Get the app" smart banner injected before </body>
     * OUTSIDE the cached page HTML (the cache stays visitor-neutral).
     * Empty URL renders nothing. Strings follow the request locale
     * (SetLocale runs before the route) with logical properties so the
     * banner flips automatically in RTL.
     *
     * Android browsers additionally get an "Open in app" pill that fires a
     * `package=`-pinned intent:// link (scheme recipereal). That launch
     * path does NOT need domain verification — it is how visitors on
     * devices whose verifier failed (Xiaomi/MIUI sideloads, state 1024)
     * still get the one-tap jump into the app from Chrome. Chrome opens
     * the app when installed and silently falls back to
     * S.browser_fallback_url (this same page) when not. The /u deep path
     * maps to user/{id} — the scheme route that ALSO exists on builds
     * older than the /u App Links wave, so an outdated install still
     * lands on the public profile screen instead of not-found.
     */
    public static function bannerHtml(Request $request, ?string $storeUrl): string
    {
        if ($storeUrl === null || $storeUrl === '') {
            return '';
        }

        $tag = __('site.banner_tag');
        $go = __('site.banner_go');

        $openPill = '';
        $openStyle = '';
        if (self::isAndroidBrowser($request)) {
            $path = (string) $request->path();
            // /u/{id} → user/{id}; everything else maps 1:1 onto the
            // scheme routes the app's bridges already handle (/r → r,
            // /p → p). rstrip the "u/" prefix, never str_replace.
            $deepPath = str_starts_with($path, 'u/') ? 'user/'.substr($path, 2) : $path;
            $intent = 'intent://'.$deepPath.'#Intent;scheme=recipereal;package=com.recipereal.app;S.browser_fallback_url='.rawurlencode($request->fullUrl()).';end';
            $openPill = '<a class="rr-open" href="'.e($intent).'" rel="noopener">'.e(__('site.banner_open')).'</a>';
            $openStyle = '#rr-store-banner .rr-open{color:#FBF8F3;background:transparent;border:1px solid rgba(251,248,243,.4);'
                .'border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;white-space:nowrap;text-decoration:none}';
        }

        return str_replace(
            ['__STORE_URL__', '__BANNER_TAG__', '__BANNER_GO__', '__OPEN_PILL__', '__OPEN_STYLE__'],
            [e($storeUrl), e($tag), e($go), $openPill, $openStyle],
            <<<'HTML'
        <style>
            #rr-store-banner{position:fixed;bottom:0;left:0;right:0;z-index:50;display:flex;
                align-items:center;gap:10px;padding:12px 16px;background:#241D17;color:#FBF8F3;
                font-family:-apple-system,system-ui,"Segoe UI",Tahoma,"Noto Sans Arabic",sans-serif;
                box-shadow:0 -4px 16px rgba(0,0,0,.18)}
            #rr-store-banner strong{font-size:14px}#rr-store-banner span{font-size:12px;opacity:.75}
            #rr-store-banner .rr-txt{min-width:0;flex:1}
            __OPEN_STYLE__
            #rr-store-banner .rr-go{background:#E86A33;color:#fff;
                border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;white-space:nowrap;text-decoration:none}
        </style>
        <div id="rr-store-banner">
            <div class="rr-txt"><strong>RecipeReal</strong><br><span>__BANNER_TAG__</span></div>
            __OPEN_PILL__
            <a class="rr-go" href="__STORE_URL__" rel="noopener">__BANNER_GO__</a>
        </div>
        HTML
        );
    }
}
