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
        // per minute, keyed by email + IP so one account can't be brute-forced
        // from a single source without also throttling everyone else.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)->by(strtolower($request->string('email')->toString()).'|'.$request->ip()));
    }
}
