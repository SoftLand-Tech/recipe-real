<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * /api/auth/google/code (authorization-code + PKCE, app 1.1.0+): the backend
 * swaps the app's one-time code + code_verifier for the id_token at Google's
 * token endpoint, then verifies/mints exactly like the implicit flow —
 * including nonce binding (claim must equal the request nonce) and
 * single-use nonces.
 *
 * RS256 tokens are signed with a throwaway RSA key whose public half is
 * served as a fake Google JWKS, and the token endpoint is faked too, so the
 * full exchange runs without leaving the test process.
 */
class GoogleCodeExchangeTest extends TestCase
{
    use RefreshDatabase;

    private const PRIMARY = '546591490861-primary-test.apps.googleusercontent.com';

    private const LEGACY = '412318680966-legacy-test.apps.googleusercontent.com';

    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';

    private string $privateKeyPem = '';

    private string $kid = 'test-rsa-key';

    /** @var array<string, mixed> */
    private array $jwks = [];

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google.client_id' => self::PRIMARY,
            'services.google.legacy_client_id' => self::LEGACY,
        ]);

        // One RSA pair per test; JWKS serves the public half. Only the certs
        // endpoint is stubbed here — fakeTokenEndpoint() must own the token
        // stub (Http::fake MERGES callbacks and the first matching stub wins,
        // so a second registration would silently lose to this one).
        $res = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($res, $this->privateKeyPem);
        $details = openssl_pkey_get_details($res);

        $this->jwks = [
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
            'https://www.googleapis.com/oauth2/v3/certs' => Http::response($this->jwks, 200),
        ]);
    }

    public function test_exchange_creates_user_and_returns_token(): void
    {
        $nonce = $this->nonce();
        $this->fakeTokenEndpoint([['id_token' => $this->idToken(self::PRIMARY, $nonce)]]);

        $response = $this->postJson('/api/auth/google/code', [
            'code' => 'one-time-auth-code',
            'code_verifier' => $this->verifier(),
            'nonce' => $nonce,
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user']);
        $this->assertNotSame('', $response->json('token'));
        $this->assertDatabaseHas('users', [
            'google_sub' => '1234567890',
            'email' => 'cook@example.com',
        ]);
    }

    public function test_google_token_endpoint_failure_maps_to_invalid_credentials(): void
    {
        $this->fakeTokenEndpoint([['error' => 'invalid_grant']], 400);

        $response = $this->postJson('/api/auth/google/code', [
            'code' => 'rejected-code',
            'code_verifier' => $this->verifier(),
            'nonce' => $this->nonce(),
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('code');
        $this->assertSame('Invalid or expired Google credentials.', $response->json('errors.code.0'));
        $this->assertDatabaseCount('users', 0);
    }

    public function test_short_code_verifier_fails_validation(): void
    {
        $response = $this->postJson('/api/auth/google/code', [
            'code' => 'one-time-auth-code',
            'code_verifier' => 'too-short',
            'nonce' => $this->nonce(),
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('code_verifier');
        $this->assertDatabaseCount('users', 0);
    }

    public function test_nonce_claim_mismatch_is_rejected(): void
    {
        // Valid token, but minted with a nonce different from the one the app
        // posts — the classic injected id_token dies here.
        $this->fakeTokenEndpoint([['id_token' => $this->idToken(self::PRIMARY, $this->nonce())]]);

        $response = $this->postJson('/api/auth/google/code', [
            'code' => 'one-time-auth-code',
            'code_verifier' => $this->verifier(),
            'nonce' => $this->nonce(),
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('id_token');
        $this->assertSame('Invalid or expired Google credentials.', $response->json('errors.id_token.0'));
        $this->assertDatabaseCount('users', 0);
    }

    public function test_nonce_replay_is_rejected(): void
    {
        $nonce = $this->nonce();

        // Google hands back a FRESH id_token per exchange (each code is
        // one-time), but both tokens carry the SAME nonce: the first sign-in
        // consumes it, the replay dies on single-use protection.
        $this->fakeTokenEndpoint([
            ['id_token' => $this->idToken(self::PRIMARY, $nonce)],
            ['id_token' => $this->idToken(self::PRIMARY, $nonce, ['name' => 'Cook Again'])],
        ]);

        $this->postJson('/api/auth/google/code', [
            'code' => 'first-code',
            'code_verifier' => $this->verifier(),
            'nonce' => $nonce,
        ])->assertOk();

        $response = $this->postJson('/api/auth/google/code', [
            'code' => 'second-code',
            'code_verifier' => $this->verifier(),
            'nonce' => $nonce,
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('id_token');
        $this->assertSame('Invalid or expired Google credentials.', $response->json('errors.id_token.0'));
    }

    public function test_32_char_app_nonce_is_accepted(): void
    {
        // CONTRACT TEST: pins the backend rule to the mobile generator's
        // nonce length (Crypto.randomUUID() minus dashes = 32 chars). If
        // this fails, standalone sign-in is broken for real users.
        $nonce = Str::random(32);

        $this->fakeTokenEndpoint([['id_token' => $this->idToken(self::PRIMARY, $nonce)]]);

        $this->postJson('/api/auth/google/code', [
            'code' => 'auth-code-32-char-nonce',
            'code_verifier' => $this->verifier(),
            'nonce' => $nonce,
        ])->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_legacy_implicit_id_token_flow_still_works(): void
    {
        $nonce = $this->nonce();

        $response = $this->postJson('/api/auth/google', [
            'id_token' => $this->idToken(self::PRIMARY, $nonce),
            'nonce' => $nonce,
        ]);

        $response->assertOk()->assertJsonStructure(['token', 'user']);
        $this->assertDatabaseHas('users', ['google_sub' => '1234567890']);
    }

    // ---- helpers -----------------------------------------------------------

    /**
     * Register the token-endpoint stub as a response QUEUE: the closure hands
     * out one body per request, in order, so a second exchange in one test
     * gets a genuinely fresh id_token. Must be the ONLY token stub registered
     * in this test (see setUp — Http::fake merges, first match wins).
     *
     * @param  list<array<string, mixed>>  $bodies
     */
    private function fakeTokenEndpoint(array $bodies, int $status = 200): void
    {
        $queue = $bodies;
        Http::fake([
            'https://www.googleapis.com/oauth2/v3/certs' => Http::response($this->jwks, 200),
            self::TOKEN_URL => function () use (&$queue, $status) {
                return Http::response(array_shift($queue) ?? ['error' => 'test_queue_exhausted'], $status);
            },
        ]);
    }

    private function nonce(): string
    {
        // The app sends Crypto.randomUUID() with dashes stripped = 32 chars
        // (login.tsx); 64 is also accepted (rule min:32,max:128).
        return bin2hex(random_bytes(16)); // 32 chars, matching the app's nonce
    }

    private function verifier(): string
    {
        return Str::random(64); // within the 43..128 PKCE verifier range
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function idToken(string $aud, string $nonce, array $extra = []): string
    {
        $header = $this->b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT', 'kid' => $this->kid]));
        $payload = $this->b64(json_encode(array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => $aud,
            'sub' => '1234567890',
            'email' => 'cook@example.com',
            'email_verified' => true,
            'name' => 'Test Cook',
            'nonce' => $nonce,
            'exp' => time() + 600,
            'iat' => time(),
        ], $extra)));

        openssl_sign($header.'.'.$payload, $sig, $this->privateKeyPem, OPENSSL_ALGO_SHA256);

        return $header.'.'.$payload.'.'.$this->b64($sig);
    }

    private function b64(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }
}
