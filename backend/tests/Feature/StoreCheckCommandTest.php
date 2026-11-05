<?php

namespace Tests\Feature;

use App\Models\AppRelease;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Covers the store-submission preflight command: it must pass with a real
 * release row + the store-required routes, and fail loudly without an APK.
 */
class StoreCheckCommandTest extends TestCase
{
    use RefreshDatabase;

    private function configureStoreEnv(): void
    {
        config([
            'app.url' => 'https://recipe-real.softland.tech',
            'services.google.client_id' => 'test-client.apps.googleusercontent.com',
            // Transitional legacy client (1.0.2 APKs) — accepted but must WARN.
            'services.google.legacy_client_id' => 'legacy-client.apps.googleusercontent.com',
            // PKCE code exchange (/api/auth/google/code) requires the secret.
            'services.google.client_secret' => 'test-secret',
            // One colon-separated SHA-256 + one plain 20-byte SHA-1 entry:
            // both shapes the fingerprint validator must accept.
            'recipereal.app_links_sha256' => '9C:4F:08:1D:2B:7E:60:4A:33:C5:8F:D9:12:7A:4E:6B:05:C8:31:FD:2E:90:B7:44:16:D3:AB:58:70:E1:C9:F6,1234567890abcdef1234567890abcdef12345678',
            'admin.emails' => 'owner@example.com',
        ]);
    }

    /**
     * The account-deletion page is added by an independent task. Register a
     * stand-in named route when it is absent so this test only exercises the
     * command itself, not that page.
     */
    private function ensureAccountDeletionRoute(): void
    {
        if (! Route::has('pages.account-delete')) {
            Route::get('/account/delete', fn (): string => 'account deletion')->name('pages.account-delete');
            // Routes added after boot must refresh the name lookup table;
            // the framework only rebuilds it once after loading route files.
            Route::getRoutes()->refreshNameLookups();
        }
    }

    private function fakeRelease(): AppRelease
    {
        Storage::fake('local');
        Storage::disk('local')->put('releases/RecipeReal-1.1.0.apk', 'fake-apk-bytes');

        return AppRelease::create([
            'version' => '1.1.0',
            'file_path' => 'releases/RecipeReal-1.1.0.apk',
            'file_size' => 14,
            'sha256' => str_repeat('a', 64),
            'notes' => 'test release',
        ]);
    }

    public function test_store_check_passes_when_release_and_required_routes_exist(): void
    {
        $this->configureStoreEnv();
        $this->fakeRelease();
        $this->ensureAccountDeletionRoute();

        $this->artisan('recipereal:store-check')
            ->expectsOutputToContain('All required checks passed')
            ->assertExitCode(0);
    }

    public function test_store_check_fails_without_an_apk_release(): void
    {
        $this->configureStoreEnv();
        $this->ensureAccountDeletionRoute();

        $this->artisan('recipereal:store-check')
            ->expectsOutputToContain('required check(s) failed')
            ->assertExitCode(1);
    }

    public function test_store_check_fails_when_app_links_sha256_is_empty(): void
    {
        $this->configureStoreEnv();
        config(['recipereal.app_links_sha256' => '']);
        $this->fakeRelease();
        $this->ensureAccountDeletionRoute();

        $this->artisan('recipereal:store-check')
            ->expectsOutputToContain('required check(s) failed')
            ->assertExitCode(1);
    }

    public function test_store_check_json_output_is_machine_readable(): void
    {
        $this->configureStoreEnv();
        $this->fakeRelease();
        $this->ensureAccountDeletionRoute();

        $this->artisan('recipereal:store-check', ['--json' => true])
            ->expectsOutputToContain('"ok": true')
            ->assertExitCode(0);
    }
}
