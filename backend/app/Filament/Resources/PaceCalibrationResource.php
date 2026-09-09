<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PaceCalibrationResource\Pages;
use App\Models\PaceCalibration;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class PaceCalibrationResource extends Resource
{
    protected static ?string $model = PaceCalibration::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChartBar;

    protected static string|UnitEnum|null $navigationGroup = 'Activity';

    public static function getModelLabel(): string
    {
        return 'Pace calibration';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Pace calibrations';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('user.name')
                            ->label('User'),
                        TextEntry::make('step_type'),
                        TextEntry::make('personal_avg_minutes')
                            ->label('Personal avg (min)'),
                        TextEntry::make('community_avg_minutes')
                            ->label('Community avg (min)'),
                        TextEntry::make('confidence'),
                        TextEntry::make('updated_at')
                            ->dateTime(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('user.name')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('step_type')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'primary',
                        'passive' => 'info',
                        'cleanup' => 'gray',
                        default => 'gray',
                    }),
                TextColumn::make('personal_avg_minutes')
                    ->label('Personal (min)'),
                TextColumn::make('community_avg_minutes')
                    ->label('Community (min)'),
                TextColumn::make('confidence'),
                TextColumn::make('updated_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('step_type')
                    ->options([
                        'active' => 'Active',
                        'passive' => 'Passive',
                        'cleanup' => 'Cleanup',
                    ]),
            ])
            ->defaultSort('updated_at', 'desc')
            ->recordActions([
                ViewAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPaceCalibrations::route('/'),
            'view' => Pages\ViewPaceCalibration::route('/{record}'),
        ];
    }
}
