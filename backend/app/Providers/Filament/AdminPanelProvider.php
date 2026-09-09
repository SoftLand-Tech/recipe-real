<?php

namespace App\Providers\Filament;

use App\Filament\Widgets\CookSessionsChartWidget;
use App\Filament\Widgets\LatestCookSessionsWidget;
use App\Filament\Widgets\LatestPostsWidget;
use App\Filament\Widgets\PostsByKindChartWidget;
use App\Filament\Widgets\SignupsChartWidget;
use App\Filament\Widgets\StatsOverviewWidget;
use App\Filament\Widgets\TopAnalyticsEventsWidget;
use App\Filament\Widgets\TopRecipesChartWidget;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Navigation\NavigationGroup;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Filament\Support\Enums\Width;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\View\Middleware\ShareErrorsFromSession;

class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            ->path('admin')
            ->viteTheme('resources/css/filament/admin/theme.css')
            ->brandName('RecipeReal Admin')
            ->brandLogo(fn () => view('filament.admin.brand'))
            ->favicon('/favicon.ico')
            ->font('DM Sans')
            ->serifFont('Fraunces')
            ->sidebarCollapsibleOnDesktop()
            ->sidebarWidth('17rem')
            ->maxContentWidth(Width::Full)
            ->login()
            // "Continue with Google" under the login form (allowlisted
            // emails only; see AdminGoogleController + routes/web.php).
            ->renderHook(
                'panels::auth.login.form.after',
                fn () => view('admin-google-button'),
            )
            ->renderHook(
                'panels::global-search.after',
                fn () => view('filament.admin.topbar-actions'),
            )
            ->colors([
                'primary' => Color::hex('#E86A33'),
                'gray' => Color::Stone,
                'success' => Color::hex('#3D8B5A'),
                'info' => Color::hex('#287C78'),
                'warning' => Color::hex('#C47A15'),
                'danger' => Color::hex('#B23A2E'),
            ])
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->widgets([
                StatsOverviewWidget::class,
                CookSessionsChartWidget::class,
                SignupsChartWidget::class,
                PostsByKindChartWidget::class,
                TopRecipesChartWidget::class,
                LatestPostsWidget::class,
                LatestCookSessionsWidget::class,
                TopAnalyticsEventsWidget::class,
            ])
            ->navigationGroups([
                NavigationGroup::make('Content')
                    ->icon('heroicon-o-book-open'),
                NavigationGroup::make('Community')
                    ->icon('heroicon-o-newspaper'),
                NavigationGroup::make('Activity')
                    ->icon('heroicon-o-chart-bar'),
                NavigationGroup::make('People')
                    ->icon('heroicon-o-identification'),
            ])
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}