<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Honeypot spam filter for the public web forms. Registered as the 'spam'
 * alias in bootstrap/app.php — the Lead attaches it to the two POST
 * routes (pages.contact.submit + pages.account-delete.submit) with:
 *
 *     ->middleware('spam')
 *
 * Two cheap signals, both fed by the visually-hidden fields in
 * pages/contact.blade.php + pages/account-delete.blade.php:
 *
 *   - 'website'        — a field real users never see or fill; bots that
 *                        autocomplete every input do.
 *   - 'form_loaded_at' — the form's render timestamp; a submission less
 *                        than 2 seconds after render is scripted (no human
 *                        reads and types that fast). Missing/future
 *                        timestamps fail closed.
 *
 * Web callers get redirected back (errors bag filled, input kept for the
 * visible fields); anything expecting JSON gets the same 422 envelope
 * Laravel's validator uses, so existing error rendering keeps working.
 */
class FilterSpam
{
    /** Minimum seconds between form render and submit. */
    private const MIN_FORM_AGE_SECONDS = 2;

    public function handle(Request $request, Closure $next): Response
    {
        $honeypotFilled = trim((string) $request->input('website', '')) !== '';
        $loadedAtRaw = $request->input('form_loaded_at');
        // Strict scalar: an array input would (int)-cast to 1 and pass.
        $loadedAt = is_numeric($loadedAtRaw) ? (int) $loadedAtRaw : -1;
        $age = $loadedAt > 0 ? time() - $loadedAt : -1;

        if ($honeypotFilled || $age < self::MIN_FORM_AGE_SECONDS) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'The form could not be submitted.',
                    'errors' => ['website' => ['The form could not be submitted.']],
                ], 422);
            }

            return redirect()
                ->back()
                ->withInput($request->except(['website', 'form_loaded_at']))
                ->withErrors(['website' => 'The form could not be submitted.']);
        }

        return $next($request);
    }
}
