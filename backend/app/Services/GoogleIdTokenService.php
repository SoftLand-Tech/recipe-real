<?php

namespace App\Services;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;

/**
 * Verifies Google OIDC id_tokens (RS256 against Google's live JWKS, with
 * explicit aud/iss checks — firebase/php-jwt does not check those itself).
 *
 * This mirrors the verification in App\Http\Controllers\Api\AuthController
 * (the mobile app's Google login) without touching that proven path; when
 * the API controller is ever refactored onto this service, delete the
 * duplicate there.
 */
class GoogleIdTokenService
{
    /**
     * @return object|null the token claims, or null when the token is
     *                     invalid, expired, or not issued for THIS client
     */
    /**
     * Every client ID whose id_tokens are accepted: the primary client plus
     * the legacy one (GOOGLE_LEGACY_CLIENT_ID) while transition-era APKs are
     * still in the wild.
     *
     * @return list<string>
     */
    public static function acceptedClientIds(): array
    {
        return array_values(array_filter([
            (string) config('services.google.client_id'),
            (string) config('services.google.legacy_client_id'),
        ], fn (string $id): bool => $id !== ''));
    }

    public function verify(string $idToken): ?object
    {
        $accepted = self::acceptedClientIds();
        if ($accepted === [] || $idToken === '') {
            return null;
        }

        try {
            $jwks = Http::timeout(10)
                ->get('https://www.googleapis.com/oauth2/v3/certs')
                ->throw()
                ->json();
            $claims = JWT::decode($idToken, JWK::parseKeySet($jwks));
        } catch (\Throwable) {
            return null;
        }

        $aud = $claims->aud ?? null;
        $audMatches = is_array($aud)
            ? (bool) array_intersect($accepted, $aud)
            : in_array($aud, $accepted, true);
        $issMatches = in_array(
            $claims->iss ?? null,
            ['https://accounts.google.com', 'accounts.google.com'],
            true,
        );

        if (! $audMatches || ! $issMatches) {
            return null;
        }

        return $claims;
    }
}
