<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The web app shell's CSP must allow Google Identity Services (script,
 * iframe button, and the client's callbacks to accounts.google.com) —
 * scoped to /app only. Regression guard for a production-only failure:
 * dev (Vite) and CI never serve the shell under Laravel's headers, so
 * nothing else catches a policy that silently kills sign-in.
 */
class SecurityHeadersAppCspTest extends TestCase
{
    public function test_app_shell_csp_allows_google_identity_services(): void
    {
        // 503 "build missing" explainer or the built shell — both are
        // text/html GETs through the web group, so both carry the policy.
        $response = $this->get('/app');

        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertStringContainsString('https://accounts.google.com', $csp);
        $this->assertStringContainsString('script-src', $csp);
        $this->assertStringContainsString('frame-src https://accounts.google.com', $csp);
        $this->assertStringContainsString('connect-src', $csp);
    }

    public function test_app_deep_links_get_the_same_policy(): void
    {
        $response = $this->get('/app/recipe/42');

        $this->assertStringContainsString(
            'https://accounts.google.com',
            (string) $response->headers->get('Content-Security-Policy'),
        );
    }

    public function test_landing_keeps_the_strict_baseline_csp(): void
    {
        $response = $this->get('/');

        $csp = (string) $response->headers->get('Content-Security-Policy');

        $this->assertNotSame('', $csp, 'landing must stay CSP-covered');
        $this->assertStringNotContainsString('accounts.google.com', $csp);
        $this->assertStringNotContainsString('frame-src', $csp);
    }

    public function test_admin_responses_stay_csp_free(): void
    {
        // The Filament panel is excluded from CSP by design (it runs its
        // own Livewire/Alpine asset stack).
        $response = $this->get('/admin/login');

        $response->assertOk();
        $this->assertSame(
            '',
            (string) $response->headers->get('Content-Security-Policy'),
        );
    }
}
