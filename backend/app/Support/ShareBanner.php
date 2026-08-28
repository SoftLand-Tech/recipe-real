<?php

namespace App\Support;

use Illuminate\Http\Request;

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
     * Self-contained "Get the app" smart banner injected before </body>
     * OUTSIDE the cached page HTML (the cache stays visitor-neutral).
     * Empty URL renders nothing.
     */
    public static function bannerHtml(?string $storeUrl): string
    {
        if ($storeUrl === null || $storeUrl === '') {
            return '';
        }

        return str_replace('__STORE_URL__', $storeUrl, <<<'HTML'
        <style>
            #rr-store-banner{position:fixed;bottom:0;left:0;right:0;z-index:50;display:flex;
                align-items:center;gap:12px;padding:12px 16px;background:#241D17;color:#FBF8F3;
                font-family:-apple-system,system-ui,sans-serif;text-decoration:none;
                box-shadow:0 -4px 16px rgba(0,0,0,.18)}
            #rr-store-banner strong{font-size:14px}#rr-store-banner span{font-size:12px;opacity:.75}
            #rr-store-banner .rr-go{margin-inline-start:auto;background:#E86A33;color:#fff;
                border-radius:999px;padding:8px 16px;font-size:13px;font-weight:700;white-space:nowrap}
        </style>
        <a id="rr-store-banner" href="__STORE_URL__" rel="noopener">
            <div><strong>RecipeReal</strong><br><span>Get the app — honest cook times, offline library</span></div>
            <span class="rr-go">Install</span>
        </a>
        HTML);
    }
}
