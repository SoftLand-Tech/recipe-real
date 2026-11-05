<?php

namespace App\Console\Commands;

use App\Models\AppRelease;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

/**
 * Store-submission preflight.
 *
 * Checks the repo/production facts that can be verified locally before an
 * APK is uploaded to APKPure, Uptodown, Samsung Galaxy Store, Xiaomi,
 * Huawei or Amazon: public store-required routes, the OAuth client config,
 * the downloadable release and its integrity metadata.
 *
 * It deliberately CANNOT verify the Google OAuth consent screen's publishing
 * status (Google Cloud Console) or Android Developer Verification - both are
 * printed as warnings and must be confirmed manually. Exit code 1 means at
 * least one required check failed; warnings do not fail the command.
 */
class StoreCheck extends Command
{
    protected $signature = 'recipereal:store-check
        {--json : Emit the checks as JSON instead of a table}';

    protected $description = 'Preflight the third-party Android store submission (routes, APK, OAuth config).';

    private const PASS = 'PASS';
    private const WARN = 'WARN';
    private const FAIL = 'FAIL';

    public function handle(): int
    {
        $checks = $this->checks();
        $failed = count(array_filter($checks, fn (array $check): bool => $check['status'] === self::FAIL));

        if ($this->option('json')) {
            $this->line((string) json_encode([
                'ok' => $failed === 0,
                'failed' => $failed,
                'checks' => $checks,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $this->info('RecipeReal - store submission preflight');
            $this->line(str_repeat('-', 72));
            $this->table(
                ['Check', 'Status', 'Detail'],
                array_map(fn (array $check): array => [
                    $check['label'],
                    $this->coloredStatus($check['status']),
                    $check['detail'],
                ], $checks),
            );
            $this->line(str_repeat('-', 72));

            if ($failed > 0) {
                $this->error("{$failed} required check(s) failed. Fix them before uploading.");
            } else {
                $this->info('All required checks passed. Manual Google OAuth consent verification still required.');
            }
        }

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<array{key: string, label: string, status: string, detail: string}>
     */
    private function checks(): array
    {
        $checks = [];

        // ---- Routes stores / reviewers rely on -----------------------------
        $namedRoutes = [
            'recipes.share' => 'Recipe share page (/r)',
            'posts.share' => 'Post share page (/p)',
            'pages.contact' => 'Contact page',
            'pages.account-delete' => 'Account deletion page (/account/delete)',
            'app.download' => 'APK download (/download)',
        ];

        foreach ($namedRoutes as $name => $label) {
            $exists = Route::has($name);
            $checks[] = $this->check(
                'route.'.$name,
                $label,
                $exists ? self::PASS : self::FAIL,
                $exists ? 'named route registered' : 'named route missing',
            );
        }

        foreach (['privacy' => 'Privacy policy (/privacy)', 'terms' => 'Terms page (/terms)'] as $uri => $label) {
            $exists = $this->routeExists($uri);
            $checks[] = $this->check(
                'route.'.$uri,
                $label,
                $exists ? self::PASS : self::FAIL,
                $exists ? 'route registered' : 'route missing',
            );
        }

        // ---- Public base URL / OAuth ---------------------------------------
        $appUrl = (string) config('app.url');
        $checks[] = $this->check(
            'app_url',
            'APP_URL uses HTTPS',
            str_starts_with($appUrl, 'https://') ? self::PASS : self::WARN,
            $appUrl !== '' ? $appUrl : '(empty)',
        );

        $clientId = trim((string) config('services.google.client_id'));
        $checks[] = $this->check(
            'google_client_id',
            'GOOGLE_CLIENT_ID configured',
            $clientId !== '' ? self::PASS : self::FAIL,
            $clientId !== ''
                ? 'configured (consent screen status must still be checked in Google Cloud Console)'
                : 'empty - Google sign-in cannot work for store users',
        );

        $package = (string) config('recipereal.android_package');
        $checks[] = $this->check(
            'android_package',
            'Android package name',
            $package === 'com.recipereal.app' ? self::PASS : self::WARN,
            $package !== '' ? $package : '(empty)',
        );

        $adminEmails = trim((string) config('admin.emails'));
        $checks[] = $this->check(
            'admin_emails',
            'ADMIN_EMAILS configured',
            $adminEmails !== '' ? self::PASS : self::WARN,
            $adminEmails !== '' ? 'admin panel is reachable' : 'empty - /admin is locked to everyone',
        );

        // ---- Downloadable release ------------------------------------------
        $release = AppRelease::latest();

        if ($release === null) {
            $checks[] = $this->check(
                'apk_release',
                'Signed APK release uploaded',
                self::FAIL,
                'no app_releases row - upload the APK in /admin -> App releases',
            );
        } else {
            $disk = Storage::disk('local');
            $path = (string) $release->file_path;
            $exists = $path !== '' && $disk->exists($path);
            $size = $exists ? (int) $disk->size($path) : 0;

            $checks[] = $this->check(
                'apk_release',
                'Signed APK release uploaded',
                $exists && $size > 0 ? self::PASS : self::FAIL,
                $exists
                    ? "v{$release->version} - ".number_format($size / 1024 / 1024, 1).' MB'
                    : "v{$release->version} - file missing at {$path}",
            );

            $checks[] = $this->check(
                'apk_sha256',
                'APK sha256 recorded',
                is_string($release->sha256) && strlen(trim($release->sha256)) === 64 ? self::PASS : self::WARN,
                is_string($release->sha256) && $release->sha256 !== '' ? $release->sha256 : 'not recorded',
            );
        }

        // ---- Manual-only checks -------------------------------------------
        $checks[] = $this->check(
            'oauth_consent',
            'Google OAuth consent screen published',
            self::WARN,
            'cannot be read from here - confirm "In production" in Google Cloud Console (see docs/google-auth.md)',
        );

        $checks[] = $this->check(
            'android_verification',
            'Android Developer Verification registration',
            self::WARN,
            'register com.recipereal.app before the 2027 global enforcement (see docs/store-submission.md)',
        );

        return $checks;
    }

    private function routeExists(string $uri): bool
    {
        foreach (Route::getRoutes()->getRoutes() as $route) {
            if ($route->uri() === $uri) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{key: string, label: string, status: string, detail: string}
     */
    private function check(string $key, string $label, string $status, string $detail): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'status' => $status,
            'detail' => $detail,
        ];
    }

    private function coloredStatus(string $status): string
    {
        return match ($status) {
            self::PASS => '<fg=green>PASS</>',
            self::WARN => '<fg=yellow>WARN</>',
            default => '<fg=red>FAIL</>',
        };
    }
}
