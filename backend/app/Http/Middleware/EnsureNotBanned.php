<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks suspended accounts from every authed API route. Runs AFTER
 * auth:sanctum — guests (no user) always pass through to the normal 401
 * handling. Banned users get a JSON 403 with a stable `code` the mobile
 * client can key off, plus the human-readable reason when one was recorded.
 */
class EnsureNotBanned
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && $user->isBanned()) {
            return response()->json([
                'message' => 'Your account has been suspended.'
                    .($user->ban_reason !== null && trim($user->ban_reason) !== ''
                        ? " Reason: {$user->ban_reason}"
                        : ' Contact support if you think this is a mistake.'),
                'code' => 'account_suspended',
            ], 403);
        }

        return $next($request);
    }
}
