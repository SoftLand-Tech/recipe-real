<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
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
        // Dedicated limiter for credential-taking auth endpoints: 5 attempts
        // per minute, keyed by email + IP so one account can't be brute-forced
        // from a single source without also throttling everyone else.
        RateLimiter::for('auth', fn (Request $request) => Limit::perMinute(5)->by(strtolower($request->string('email')->toString()).'|'.$request->ip()));

        // The app is API-only (no web routes), so the default reset email
        // would fatal building its URL via route('password.reset'). Build a
        // stable client-facing URL instead; the token itself is consumed via
        // POST /api/auth/reset-password.
        ResetPassword::createUrlUsing(
            fn ($notifiable, $token) => config('app.url').'/reset-password?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset())
        );
    }
}
