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
        $nonce = Str::random(32);
        $request->session()->put('admin_google_state', $state);
        $request->session()->put('admin_google_nonce', $nonce);

        $redirectUri = (string) config('services.google.admin_redirect_uri');
        if ($redirectUri === '') {
            $redirectUri = rtrim((string) config('app.url'), '/').'/admin/auth/google/callback';
        }

        $params = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'id_token',
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => $nonce,
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

        // Nonce binding: the id_token must carry the exact nonce this session
        // generated for THIS attempt — a validly-signed token minted for any
        // other flow/replay is refused even though verification passes.
        $expectedNonce = (string) $request->session()->pull('admin_google_nonce', '');
        if ($expectedNonce === ''
            || ! isset($claims->nonce)
            || ! hash_equals($expectedNonce, (string) $claims->nonce)) {
            return $this->reject($request, 'nonce');
        }

        $email = strtolower(trim((string) ($claims->email ?? '')));
        $googleSub = (string) ($claims->sub ?? '');

        // Hard allowlist: only these emails may EVER enter the panel.
        if ($email === '' || ! in_array($email, $this->allowedEmails(), true)) {
            return $this->reject($request, 'not_admin');
        }

        // Identity lookup keys on google_sub ONLY. The email fallback would
        // let any Google identity carrying an allowlisted email bind itself
        // to the admin row — the allowlist gates the ADDRESS, but only the
        // stored google_sub proves the ORIGINAL identity is presenting.
        $user = User::where('google_sub', $googleSub)->first();
        if ($user === null) {
            if (empty($claims->email_verified ?? false)) {
                return $this->reject($request, 'email_unverified');
            }
            if (User::where('email', $email)->exists()) {
                // An existing account holds this email under a different
                // Google identity: never link, never mint a second admin row.
                return $this->reject($request, 'email_conflict');
            }

            $user = User::create([
                'name' => $claims->name ?? explode('@', $email)[0],
                'email' => $email,
                // Random password; never usable, but the column is not
                // nullable. The hashed cast encrypts it like any other.
                'password' => Str::random(40),
                'google_sub' => $googleSub,
                'display_name' => $claims->name ?? null,
                'avatar_url' => $claims->picture ?? null,
            ]);
            $user->refresh();
        } elseif ((string) $user->email !== $email) {
            return $this->reject($request, 'email_conflict');
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended('/admin');
    }

    /** @return list<string> lower-cased allowlist from config('admin.emails') */
    private function allowedEmails(): array
    {
        // config('admin.emails') is a COMMA-SEPARATED STRING (see
        // config/admin.php) — split it exactly like User::canAccessPanel;
        // casting the string to array would keep it as one joined element
        // and no email would ever match.
        return collect(explode(',', (string) config('admin.emails')))
            ->map(fn (string $email): string => strtolower(trim($email)))
            ->filter()
            ->values()
            ->all();
    }

    private function reject(Request $request, string $reason): RedirectResponse
    {
        report_if(config('app.debug'), "Admin Google login rejected ({$reason}).");

        return redirect()
            ->to('/admin/login')
            ->with('status', 'admin-google-rejected');
    }
}
