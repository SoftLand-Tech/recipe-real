<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\RecipeDedupServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    RecipeDedupServiceProvider::class,
];
