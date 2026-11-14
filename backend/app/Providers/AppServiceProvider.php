<?php

namespace App\Providers;

use App\Support\UploadLimits;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Startup guard for recipe-import uploads: the admin advertises
        // 100 MB videos, so warn early when php.ini would make Livewire
        // fail with "data.primary_file.* failed to upload".
        foreach (UploadLimits::issues() as $issue) {
            Log::warning('upload_limits.too_low', ['issue' => $issue]);
        }

        // Dedicated limiter for the credential-taking auth endpoints (the
        // implicit POST /auth/google and the PKCE POST /auth/google/code):
        // 5 attempts per minute per IP. Both payloads are single-use Google
        // credentials whose value differs on every attempt, so the former
        // token-hash bucket never accumulated counts — the IP is the only
        // stable identity an unauthenticated caller presents. One strict
        // bucket replaces the old dead tok-hash + redundant 20/min IP pair.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)->by('ip:'.$request->ip()));
    }
}
