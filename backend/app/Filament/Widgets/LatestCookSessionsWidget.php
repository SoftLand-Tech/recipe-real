<?php

namespace App\Filament\Widgets;

use App\Models\CookSession;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class LatestCookSessionsWidget extends TableWidget
{
    protected static ?int $sort = 7;

    protected int|string|array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(CookSession::query()->latest())
            ->poll('30s')
            ->columns([
                TextColumn::make('user.name')
                    ->label('User'),
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->limit(40),
                TextColumn::make('total_actual_minutes')
                    ->label('Actual (min)'),
                TextColumn::make('source')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'quick' => 'success',
                        'cook' => 'primary',
                        default => 'gray',
                    }),
                TextColumn::make('feedback')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
                        'faster' => 'info',
                        'as_expected' => 'success',
                        'slower' => 'warning',
                        default => 'gray',
                    })
                    ->placeholder('—'),
                TextColumn::make('created_at')
                    ->since(),
            ])
            ->paginated([5, 10, 25]);
    }
}
