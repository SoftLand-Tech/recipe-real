<?php

namespace Tests\Feature;

use App\Services\GoogleIdTokenService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The backend accepts id_tokens minted for the PRIMARY Google client or the
 * LEGACY one (GOOGLE_LEGACY_CLIENT_ID) during the client-ID transition:
 * distributed 1.0.2 APKs still carry the old project's client ID.
 *
 * RS256 tokens are signed with a throwaway RSA key whose public half is
 * served as a fake Google JWKS, so the full verify() path runs — signature,
 * iss, and the aud allowlist under test.
 */
class GoogleClientTransitionTest extends TestCase
{
    use RefreshDatabase;

    private const PRIMARY = '546591490861-primary-test.apps.googleusercontent.com';

    private const LEGACY = '412318680966-legacy-test.apps.googleusercontent.com';

    private const OTHER = '999999-other-project.apps.googleusercontent.com';

    private string $privateKeyPem = '';

    private string $kid = 'test-rsa-key';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => self::PRIMARY,
            'services.google.legacy_client_id' => self::LEGACY,
        ]);

        // One RSA pair per test; JWKS serves the public half.
        $res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($res, $this->privateKeyPem);
        $details = openssl_pkey_get_details($res);

        $jwks = [
            'keys' => [[
                'kty' => 'RSA',
                'alg' => 'RS256',
                'use' => 'sig',
                'kid' => $this->kid,
                'n' => $this->b64($details['rsa']['n']),
                'e' => $this->b64($details['rsa']['e']),
            ]],
        ];

        Http::fake([
            'https://www.googleapis.com/oauth2/v3/certs' => Http::response($jwks, 200),
        ]);
    }

    public function test_accepted_ids_contains_primary_then_legacy(): void
    {
        $this->assertSame([self::PRIMARY, self::LEGACY], GoogleIdTokenService::acceptedClientIds());
    }

    public function test_accepted_ids_skips_empty_legacy(): void
    {
        config(['services.google.legacy_client_id' => '']);

        $this->assertSame([self::PRIMARY], GoogleIdTokenService::acceptedClientIds());
    }

    public function test_verify_accepts_token_minted_for_legacy_client(): void
    {
        $claims = app(GoogleIdTokenService::class)->verify($this->idToken(self::LEGACY));

        $this->assertNotNull($claims, 'legacy-client token must be accepted during transition');
        $this->assertSame(self::LEGACY, $claims->aud);
        $this->assertSame('1234567890', $claims->sub);
    }

    public function test_verify_accepts_token_minted_for_primary_client(): void
    {
        $claims = app(GoogleIdTokenService::class)->verify($this->idToken(self::PRIMARY));

        $this->assertNotNull($claims, 'primary-client token must be accepted');
        $this->assertSame(self::PRIMARY, $claims->aud);
    }

    public function test_verify_rejects_token_for_unrelated_client(): void
    {
        $this->assertNull(app(GoogleIdTokenService::class)->verify($this->idToken(self::OTHER)));
    }

    public function test_verify_rejects_expired_token_for_accepted_client(): void
    {
        $this->assertNull(app(GoogleIdTokenService::class)->verify(
            $this->idToken(self::PRIMARY, time() - 3600)
        ));
    }

    // ---- helpers -----------------------------------------------------------

    private function idToken(string $aud, ?int $exp = null): string
    {
        $header = $this->b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => $this->kid]));
        $payload = $this->b64(json_encode([
            'iss' => 'https://accounts.google.com',
            'aud' => $aud,
            'sub' => '1234567890',
            'email' => 'cook@example.com',
            'email_verified' => true,
            'exp' => $exp ?? time() + 600,
            'iat' => time(),
        ]));

        openssl_sign($header.'.'.$payload, $sig, $this->privateKeyPem, OPENSSL_ALGO_SHA256);

        return $header.'.'.$payload.'.'.$this->b64($sig);
    }

    private function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
