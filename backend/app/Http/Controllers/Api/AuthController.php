<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\GoogleLoginRequest;
use App\Services\GoogleIdTokenService;
use App\Http\Resources\UserResource;
use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Exchange a Google Sign-In ID token for a Sanctum token, creating the
     * local account or linking an existing one by email.
     *
     * @throws ValidationException
     */
    public function google(GoogleLoginRequest $request): JsonResponse
    {
        $clientId = config('services.google.client_id');

        if (! $clientId) {
            throw ValidationException::withMessages([
                'id_token' => ['Google sign-in is not configured.'],
            ]);
        }

        return $this->issueForGoogleIdToken(
            $request->string('id_token')->toString(),
            $request->string('nonce')->toString(),
        );
    }

    /**
     * Authorization-code + PKCE exchange (standalone builds, 1.1.0+): the app
     * opens Google with an S256 code_challenge and returns with a one-time
     * code; we swap it — plus its verifier and the client secret — for the
     * id_token at Google's token endpoint, then verify/mint exactly like the
     * implicit flow above. The secret lives server-side only.
     *
     * @throws ValidationException
     */
    public function exchangeCode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:500'],
            'code_verifier' => ['required', 'string', 'min:43', 'max:128'],
            // The mobile app generates Crypto.randomUUID() with dashes
            // stripped = 32 hex chars; older/other clients may send longer.
            'nonce' => ['required', 'string', 'min:32', 'max:128'],
        ]);

        if (! config('services.google.client_id')) {
            throw ValidationException::withMessages([
                'code' => ['Google sign-in is not configured.'],
            ]);
        }

        $tokenResponse = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'code' => $data['code'],
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'code_verifier' => $data['code_verifier'],
            'grant_type' => 'authorization_code',
            // Must byte-match the redirect_uri the app used to start the flow.
            'redirect_uri' => config('app.url').'/auth/callback',
        ]);

        $idToken = $tokenResponse->json('id_token');

        if ($tokenResponse->failed() || ! is_string($idToken) || $idToken === '') {
            throw ValidationException::withMessages([
                'code' => ['Invalid or expired Google credentials.'],
            ]);
        }

        return $this->issueForGoogleIdToken($idToken, $data['nonce']);
    }

    /**
     * Shared verification + account linking behind both sign-in paths
     * (implicit id_token and PKCE code exchange): JWKS-verified claims in,
     * Sanctum token + user JSON out.
     */
    private function issueForGoogleIdToken(string $idToken, string $expectedNonce): JsonResponse
    {
        // Verify the ID token against Google's public JWKS (RS256 signature,
        // expiry, not-before). aud/iss are not checked by firebase/php-jwt and
        // are validated manually below. `sub` is the stable per-account
        // identifier; emails may change, so google_sub drives the lookup.
        // The key set is cached 24h (Google rotates every ~2 weeks; a deploy
        // cache:clear refreshes early) — sign-in no longer blocks on the
        // certs fetch. Failures are NOT cached: Http::throw() inside the
        // remember closure aborts the store and falls to the same catch.
        try {
            $jwks = Cache::remember('google.jwks', 86400, fn () => Http::throw()
                ->get('https://www.googleapis.com/oauth2/v3/certs')
                ->json());

            JWT::$leeway = 60;
            $claims = JWT::decode($idToken, JWK::parseKeySet($jwks));
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
            ]);
        }

        // Accept tokens minted for the primary client OR the legacy one
        // (GOOGLE_LEGACY_CLIENT_ID): distributed 1.0.2 APKs still carry the
        // old project's client ID until the next binary release.
        $acceptedClientIds = GoogleIdTokenService::acceptedClientIds();
        $aud = $claims->aud ?? null;
        $audMatches = is_array($aud)
            ? (bool) array_intersect($acceptedClientIds, $aud)
            : in_array($aud, $acceptedClientIds, true);
        $issMatches = in_array($claims->iss ?? null, ['https://accounts.google.com', 'accounts.google.com'], true);

        if (! $audMatches || ! $issMatches) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
            ]);
        }

        // Nonce binding: the client generates a fresh single-use nonce per
        // sign-in attempt and Google embeds it inside the id_token. Requiring
        // an exact match proves this token was minted FOR this attempt — an
        // id_token injected by another app (custom-scheme intent) or replayed
        // from an earlier sign-in carries a different/absent nonce and dies
        // here, even though its signature is perfectly valid.
        $tokenNonce = isset($claims->nonce) && is_string($claims->nonce) ? $claims->nonce : '';
        if ($expectedNonce === '' || $tokenNonce === '' || ! hash_equals($expectedNonce, $tokenNonce)) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
            ]);
        }

        // Single-use nonces: the first successful sign-in presenting a nonce
        // consumes it, so a replay of the same (signature-valid,
        // nonce-matching) id_token — or of an exchanged id_token re-posted
        // with a new code — dies here.
        if (! Cache::add('google:nonce:'.hash('sha256', $tokenNonce), true, now()->addMinutes(75))) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
            ]);
        }

        $googleSub = $claims->sub;
        $email = strtolower($claims->email ?? '');

        // A verified email is required so the profile has a usable address.
        if (empty($googleSub) || $email === '' || empty($claims->email_verified)) {
            throw ValidationException::withMessages([
                'id_token' => ['Google account has no verified email.'],
            ]);
        }

        // Identity lookup keys on google_sub ONLY. Matching by verified email
        // would let any Google identity carrying someone's email silently bind
        // to (and take over) their local account — the email claim proves the
        // signer controls the ADDRESS TODAY, not that the original registrant
        // is the one signing in. A distinct-sub row with the same email simply
        // fails creation on the unique constraint below.
        $user = User::where('google_sub', $googleSub)->first();

        // Community identity from the Google profile: the picture (capped at
        // 500 chars, the users.avatar_url column width) seeds avatar_url.
        $avatarUrl = isset($claims->picture) && is_string($claims->picture)
            ? mb_substr($claims->picture, 0, 500)
            : null;

        if ($user === null) {
            // A different Google identity already owns this email: refuse
            // rather than silently creating a duplicate-identity account.
            if (User::where('email', $email)->exists()) {
                throw ValidationException::withMessages([
                    'id_token' => ['This email is registered with a different sign-in method.'],
                ]);
            }

            try {
                $user = User::create([
                    'name' => $claims->name ?? explode('@', $email)[0],
                    'email' => $email,
                    // Random password; never usable, but the column is not
                    // nullable. The hashed cast encrypts it like any other.
                    'password' => Str::random(40),
                    'google_sub' => $googleSub,
                    // display_name stays NULL on creation: onboarding owns
                    // it — the user must type a name themselves (the
                    // has_display_name flag in ProfileController::payload
                    // routes fresh sign-ins to /onboarding until they do).
                    // The internal `name` column still seeds from Google.
                    'display_name' => null,
                    'avatar_url' => $avatarUrl,
                ]);

                // Reload so DB-applied defaults (e.g. skill_level) are reflected.
                $user->refresh();
            } catch (QueryException) {
                // Race on the unique constraints: re-fetch by sub ONLY — the
                // concurrent creator must be this same Google identity.
                $user = User::where('google_sub', $googleSub)->first();

                if ($user === null) {
                    throw ValidationException::withMessages([
                        'id_token' => ['Invalid or expired Google credentials.'],
                    ]);
                }
            }
        } elseif ((string) $user->google_sub !== (string) $googleSub) {
            // Defense-in-depth: a row resolved via google_sub can never hit
            // this branch, but guard it anyway — never mint tokens for an
            // account whose stored identity differs from the presented one.
            throw ValidationException::withMessages([
                'id_token' => ['This email is registered with a different sign-in method.'],
            ]);
        } else {
            // Existing user signing in with their bound identity: refresh the
            // avatar seed only (never rebind google_sub — that path was the
            // account-takeover vector).
            $patch = [];
            if ($avatarUrl !== null && empty($user->avatar_url)) {
                $patch['avatar_url'] = $avatarUrl;
            }
            if ($patch !== []) {
                $user->forceFill($patch)->save();
            }
        }

        // Suspended accounts cannot mint fresh tokens (banning revokes the
        // old ones; without this check the user would sign straight back in).
        if ($user->isBanned()) {
            throw ValidationException::withMessages([
                'id_token' => ['Your account has been suspended. Contact support if you think this is a mistake.'],
            ]);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(null, 204);
    }
}
