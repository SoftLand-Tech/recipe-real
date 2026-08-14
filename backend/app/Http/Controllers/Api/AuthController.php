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
        try {
            $jwks = Http::throw()
                ->get('https://www.googleapis.com/oauth2/v3/certs')
                ->json();

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

        // A verified email is required so existing accounts can be linked safely.
        if (empty($googleSub) || $email === '' || empty($claims->email_verified)) {
            throw ValidationException::withMessages([
                'id_token' => ['Google account has no verified email.'],
            ]);
        }

        $user = User::where('google_sub', $googleSub)->first()
            ?? User::where('email', $email)->first();

        if ($user === null) {
            try {
                $user = User::create([
                    'name' => $claims->name ?? explode('@', $email)[0],
                    'email' => $email,
                    // Random password; never usable, but the column is not
                    // nullable. The hashed cast encrypts it like any other.
                    'password' => Str::random(40),
                    'google_sub' => $googleSub,
                ]);

                // Reload so DB-applied defaults (e.g. skill_level) are reflected.
                $user->refresh();
            } catch (QueryException) {
                // Race on the unique email/google_sub constraints: re-fetch
                // whichever row the concurrent request created.
                $user = User::where('email', $email)->first()
                    ?? User::where('google_sub', $googleSub)->first();

                if ($user === null) {
                    throw ValidationException::withMessages([
                        'id_token' => ['Invalid or expired Google credentials.'],
                    ]);
                }
            }
        } else {
            $user->forceFill(['google_sub' => $googleSub])->save();
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
