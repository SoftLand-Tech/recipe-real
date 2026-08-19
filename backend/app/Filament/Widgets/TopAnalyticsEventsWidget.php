<?php

namespace App\Filament\Widgets;

use App\Models\AnalyticsEvent;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Model;

class TopAnalyticsEventsWidget extends TableWidget
{
    protected int | string | array $columnSpan = 'full';

    /**
     * Grouped aggregate rows carry only `name` + `total` — no primary key —
     * so the default `$record->getKey()` returns null and the table render
     * throws a TypeError ("Return value must be of type string, null
     * returned"). The grouped event name is the stable unique row key.
     */
    public function getTableRecordKey(Model | array $record): string
    {
        if (is_array($record)) {
            return parent::getTableRecordKey($record);
        }

        return (string) $record->getAttributeValue('name');
    }

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