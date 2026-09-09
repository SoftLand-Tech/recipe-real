<?php

namespace App\Filament\Resources;

use App\Filament\Resources\TimingSubmissionResource\Pages;
use App\Models\TimingSubmission;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class TimingSubmissionResource extends Resource
{
    protected static ?string $model = TimingSubmission::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClock;

    protected static string|UnitEnum|null $navigationGroup = 'Activity';

    public static function getModelLabel(): string
    {
        return 'Timing submission';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Timing submissions';
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
                        TextEntry::make('recipeStep.recipe.title')
                            ->label('Recipe'),
                        TextEntry::make('recipeStep.description')
                            ->label('Step'),
                        TextEntry::make('actual_minutes')
                            ->label('Actual (min)'),
                        TextEntry::make('session_id')
                            ->label('Session')
                            ->copyable(),
                        TextEntry::make('created_at')
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
                TextColumn::make('recipeStep.recipe.title')
                    ->label('Recipe')
                    ->limit(40),
                TextColumn::make('recipeStep.description')
                    ->label('Step')
                    ->limit(50),
                TextColumn::make('actual_minutes')
                    ->label('Actual (min)')
                    ->sortable(),
                TextColumn::make('session_id')
                    ->label('Session')
                    ->limit(16),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Filter::make('created_at')
                    ->label('Date range')
                    ->schema([
                        DatePicker::make('created_from')
                            ->label('From'),
                        DatePicker::make('created_until')
                            ->label('Until'),
                    ])
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['created_from'] ?? null, fn (Builder $query, $from) => $query->whereDate('created_at', '>=', $from))
                        ->when($data['created_until'] ?? null, fn (Builder $query, $until) => $query->whereDate('created_at', '<=', $until))),
            ])
            ->defaultSort('id', 'desc')
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
            'index' => Pages\ListTimingSubmissions::route('/'),
            'view' => Pages\ViewTimingSubmission::route('/{record}'),
        ];
    }
}
