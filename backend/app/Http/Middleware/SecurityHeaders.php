<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Baseline security headers on every web response (appended to the web
 * middleware group in bootstrap/app.php):
 *
 *   X-Content-Type-Options nosniff — always.
 *   Referrer-Policy strict-origin-when-cross-origin — always.
 *   X-Frame-Options DENY for admin/* (the panel must never be framed),
 *     SAMEORIGIN elsewhere (share pages stay embeddable same-origin).
 *   Strict-Transport-Security max-age=31536000 only when the request
 *     arrived over TLS — never promising HSTS on a plain-http dev host.
 *   Content-Security-Policy only for non-admin GET responses that return
 *     HTML (the APK /download stream, API JSON and the Filament panel
 *     — which runs its own Livewire/Alpine stack — are excluded).
 */
class SecurityHeaders
{
    private const CSP = "default-src 'self'; img-src 'self' https: data:; "
        ."style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; "
        ."font-src 'self' https://fonts.gstatic.com data:; connect-src 'self'; "
        ."frame-ancestors 'self'";

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $isAdmin = $request->is('admin') || $request->is('admin/*');

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $response->headers->set('X-Frame-Options', $isAdmin ? 'DENY' : 'SAMEORIGIN');

        if ($request->secure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        if (! $isAdmin && $request->isMethod('GET') && $this->returnsHtml($response)) {
            $response->headers->set('Content-Security-Policy', self::CSP);
        }

        return $response;
    }

    private function returnsHtml(Response $response): bool
    {
        return str_contains(
            strtolower((string) $response->headers->get('Content-Type')),
            'text/html',
        );
    }
}
