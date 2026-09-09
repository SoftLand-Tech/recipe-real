<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Locale negotiation for the public web (landing + content + share pages).
 *
 * Priority:
 *   1. Explicit `?lang=en|ar` query param (persisted to session + cookie).
 *   2. Previously persisted choice (session, then `locale` cookie).
 *   3. The visitor's device language — the browser's Accept-Language
 *      header (`Request::getPreferredLanguage()`), ar_* → ar, else en.
 *
 * The admin panel (/admin/*) is intentionally excluded: it always stays
 * English LTR regardless of the visitor's locale.
 */
class SetLocale
{
    /** Locales the public web can render. */
    public const SUPPORTED = ['en', 'ar'];

    public function handle(Request $request, Closure $next): Response
    {
        // Admin panel: pinned to English, never translated / never RTL.
        if ($request->is('admin') || $request->is('admin/*')) {
            App::setLocale('en');
            return $next($request);
        }

        $locale = null;
        $explicit = false;

        $query = $request->query('lang');
        if (is_string($query) && in_array($query, self::SUPPORTED, true)) {
            $locale = $query;
            $explicit = true;
            $request->session()->put('locale', $locale);
        }

        if ($locale === null) {
            $stored = $request->session()->get('locale');
            if (is_string($stored) && in_array($stored, self::SUPPORTED, true)) {
                $locale = $stored;
            }
        }

        if ($locale === null) {
            $cookie = $request->cookie('locale');
            if (is_string($cookie) && in_array($cookie, self::SUPPORTED, true)) {
                $locale = $cookie;
            }
        }

        if ($locale === null) {
            // Device language: first Accept-Language match, ar_* → ar.
            $locale = $request->getPreferredLanguage(self::SUPPORTED) ?? 'en';
        }

        App::setLocale($locale);

        /** @var \Illuminate\Http\Response|\Symfony\Component\HttpFoundation\Response $response */
        $response = $next($request);

        if ($explicit && method_exists($response, 'withCookie')) {
            $response->withCookie(cookie()->forever('locale', $locale));
        }

        return $response;
    }
}
