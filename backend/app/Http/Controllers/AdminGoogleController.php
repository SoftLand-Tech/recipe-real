<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\GoogleIdTokenService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

/**
 * "Continue with Google" for the Filament admin panel (/admin).
 *
 * Uses Google's implicit id_token flow — the SAME client and verification
 * as the mobile app's login (GoogleIdTokenService) — and logs the matching
 * user into the WEB guard (session), which Filament's panel accepts.
 * Only emails on the ADMIN_EMAILS allowlist (config('admin.emails')) may
 * enter; everyone else is bounced back to the login screen.
 */
class AdminGoogleController extends Controller
{
    public function __construct(private readonly GoogleIdTokenService $google)
    {
    }

    /**
     * Start the flow: bounce to Google's consent screen with OUR callback
     * as the redirect target and a random state for CSRF.
     */
    public function redirect(Request $request): RedirectResponse
    {
        $clientId = (string) config('services.google.client_id');
        abort_if($clientId === '', 503, 'Google login is not configured.');

        $state = Str::random(40);
        $request->session()->put('admin_google_state', $state);

        $params = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => rtrim((string) config('app.url'), '/').'/admin/auth/google/callback',
            'response_type' => 'id_token',
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => Str::random(32),
        ]);

        return redirect()->away('https://accounts.google.com/o/oauth2/v2/auth?'.$params);
    }

    /**
     * Google returns here. The id_token arrives in the URL FRAGMENT (never
     * sent to servers), so the FIRST hit renders a tiny trampoline page that
     * re-enters this route with the fragment converted to a query; the
     * SECOND hit verifies and logs in.
     */
    public function callback(Request $request)
    {
        $idToken = $request->query('id_token');
        if (! is_string($idToken) || $idToken === '') {
            return response()->view('admin-google-callback');
        }

        // CSRF: the state must match what this session started.
        $expected = (string) $request->session()->pull('admin_google_state', '');
        if ($expected === '' || ! hash_equals($expected, (string) $request->query('state', ''))) {
            return $this->reject($request, 'state');
        }

        $claims = $this->google->verify($idToken);
        if ($claims === null) {
            return $this->reject($request, 'token');
        }

        $email = strtolower(trim((string) ($claims->email ?? '')));
        $googleSub = (string) ($claims->sub ?? '');

        // Hard allowlist: only these emails may EVER enter the panel.
        if ($email === '' || ! in_array($email, $this->allowedEmails(), true)) {
            return $this->reject($request, 'not_admin');
        }

        // Same linking rule as the API login: google_sub first, verified
        // email second (identifier per Google's guidance).
        $user = User::where('google_sub', $googleSub)->first();
        if ($user === null && ! empty($claims->email_verified ?? false)) {
            $user = User::where('email', $email)->first();
        }
        if ($user === null) {
            return $this->reject($request, 'no_account');
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended('/admin');
    }

    /** @return list<string> lower-cased allowlist from config('admin.emails') */
    private function allowedEmails(): array
    {
        return array_values(array_filter(array_map(
            fn (string $e) => strtolower(trim($e)),
            (array) config('admin.emails', []),
        )));
    }

    private function reject(Request $request, string $reason): RedirectResponse
    {
        report_if(config('app.debug'), "Admin Google login rejected ({$reason}).");

        return redirect()
            ->to('/admin/login')
            ->with('status', 'admin-google-rejected');
    }
}
