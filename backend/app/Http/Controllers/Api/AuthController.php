<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\GoogleLoginRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
        ]);

        // Reload so DB-applied defaults (e.g. skill_level) are reflected.
        $user->refresh();

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ], 201);
    }

    /**
     * @throws ValidationException
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email')->toString())->first();

        if ($user === null || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'email' => [trans('auth.failed')],
            ]);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user),
        ]);
    }

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

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $status = Password::sendResetLink(
            $request->only('email')
        );

        // Always return the same generic response so the endpoint cannot be
        // used to enumerate which emails have accounts. The real status is
        // logged server-side so debugging stays possible.
        logger()->info('Password reset link requested.', [
            'email' => $request->string('email')->toString(),
            'status' => $status,
        ]);

        return response()->json([
            'message' => 'If an account exists for this email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->setRememberToken(str()->random(60));

                $user->save();

                // Revoke all tokens so a password reset evicts every
                // session/device that was signed in with the old password.
                $user->tokens()->delete();
            }
        );

        return response()->json([
            'message' => trans($status),
            'status' => $status,
        ], $status === Password::PASSWORD_RESET ? 200 : 422);
    }
}
