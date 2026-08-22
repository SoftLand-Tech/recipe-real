<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\GoogleLoginRequest;
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
            $claims = JWT::decode($request->string('id_token')->toString(), JWK::parseKeySet($jwks));
        } catch (\Throwable $e) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
            ]);
        }

        $aud = $claims->aud ?? null;
        $audMatches = is_array($aud) ? in_array($clientId, $aud, true) : $aud === $clientId;
        $issMatches = in_array($claims->iss ?? null, ['https://accounts.google.com', 'accounts.google.com'], true);

        if (! $audMatches || ! $issMatches) {
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

        // Nonce binding: the client generates a fresh single-use nonce per
        // sign-in attempt and Google embeds it inside the id_token. Requiring
        // an exact match proves this token was minted FOR this attempt — an
        // id_token injected by another app (custom-scheme intent) or replayed
        // from an earlier sign-in carries a different/absent nonce and dies
        // here, even though its signature is perfectly valid.
        $nonce = (string) $request->string('nonce')->toString();
        $tokenNonce = isset($claims->nonce) && is_string($claims->nonce) ? $claims->nonce : '';
        if ($nonce === '' || $tokenNonce === '' || ! hash_equals($nonce, $tokenNonce)) {
            throw ValidationException::withMessages([
                'id_token' => ['Invalid or expired Google credentials.'],
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
                    // display_name only seeds on first creation; afterwards
                    // the user owns it (PATCH /api/users/me/profile).
                    'display_name' => $claims->name ?? null,
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
