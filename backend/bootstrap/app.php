<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Suspended accounts are rejected from every authed API route (the
        // alias is attached to the auth:sanctum groups in routes/api.php).
        $middleware->alias([
            'not_banned' => \App\Http\Middleware\EnsureNotBanned::class,
        ]);
        // Admin-panel (web) guests are sent to the panel login; API guests
        // get null (no redirect target) so the render handler below can
        // answer with JSON 401 instead of "Route [login] not defined."
        $middleware->redirectGuestsTo(
            fn (Request $request) => $request->is('admin') || $request->is('admin/*')
                ? '/admin/login'
                : null,
        );
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            // Web panel guests redirect to the login; everything else is an
            // API caller — JSON 401, no login route exists for them.
            if ($request->is('admin') || $request->is('admin/*')) {
                return redirect()->guest('/admin/login');
            }

            return response()->json(['message' => $e->getMessage()], 401);
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
