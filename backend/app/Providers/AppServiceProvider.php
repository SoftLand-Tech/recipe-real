<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
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
        // Dedicated limiter for the credential-taking auth endpoint: 5 attempts
        // per minute. The endpoint accepts an id_token (never an email), so
        // key on a hash of the token payload — per-credential throttling —
        // plus the IP, so one account can't be brute-forced from rotating IPs
        // and one IP can't melt the endpoint for everyone behind it.
        RateLimiter::for('auth', fn (Request $request) => [
            Limit::perMinute(5)->by('tok:'.sha1($request->string('id_token')->toString())),
            Limit::perMinute(20)->by('ip:'.$request->ip()),
        ]);
    }
}
