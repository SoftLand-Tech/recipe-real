<?php

namespace App\Filament\Widgets;

use App\Models\AnalyticsEvent;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class TopAnalyticsEventsWidget extends TableWidget
{
    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(
                AnalyticsEvent::query()
                    ->select('name')
                    ->selectRaw('COUNT(*) AS total')
                    ->where('created_at', '>=', now()->startOfDay())
                    ->groupBy('name')
                    ->orderByDesc('total')
                    ->limit(10)
            )
            ->poll('60s')
            ->columns([
                TextColumn::make('name')
                    ->label('Event name'),
                TextColumn::make('total')
                    ->label('Count today')
                    ->badge()
                    ->color('warning'),
            ])
            ->paginated(false);
    }
}