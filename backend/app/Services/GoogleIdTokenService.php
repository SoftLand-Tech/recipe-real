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
     *                    invalid, expired, or not issued for THIS client
     */
    public function verify(string $idToken): ?object
    {
        $clientId = (string) config('services.google.client_id');
        if ($clientId === '' || $idToken === '') {
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
            ? in_array($clientId, $aud, true)
            : $aud === $clientId;
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
