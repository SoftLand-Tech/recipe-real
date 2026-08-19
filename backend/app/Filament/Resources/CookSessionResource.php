<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\CookSessionResource\Pages;
use App\Models\CookSession;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CookSessionResource extends Resource
{
    protected static ?string $model = CookSession::class;

    protected static string | BackedEnum | null $navigationIcon = Heroicon::OutlinedClock;

    protected static string | UnitEnum | null $navigationGroup = 'Activity';

    protected static ?string $recordTitleAttribute = 'id';

    public static function getModelLabel(): string
    {
        return 'Cook session';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Cook sessions';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Select::make('feedback')
                    ->options([
                        'faster' => 'Faster than expected',
                        'as_expected' => 'As expected',
                        'slower' => 'Slower than expected',
                    ])
                    ->nullable(),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('user.name')
                            ->label('User'),
                        TextEntry::make('recipe.title')
                            ->label('Recipe'),
                        TextEntry::make('total_actual_minutes')
                            ->label('Actual time (min)')
                            ->placeholder('—'),
                        TextEntry::make('cleanup_minutes')
                            ->label('Cleanup (min)')
                            ->placeholder('—'),
                        TextEntry::make('hands_on_minutes')
                            ->label('Hands-on (min)')
                            ->placeholder('—'),
                        TextEntry::make('servings')
                            ->placeholder('—'),
                        TextEntry::make('source')
                            ->placeholder('—'),
                        TextEntry::make('feedback')
                            ->placeholder('—'),
                        TextEntry::make('idempotency_key')
                            ->label('Idempotency key')
                            ->placeholder('—')
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
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->searchable()
                    ->limit(40),
                TextColumn::make('total_actual_minutes')
                    ->label('Actual (min)')
                    ->sortable()
                    ->placeholder('—'),
                TextColumn::make('cleanup_minutes')
                    ->label('Cleanup (min)')
                    ->placeholder('—'),
                TextColumn::make('hands_on_minutes')
                    ->label('Hands-on (min)')
                    ->placeholder('—'),
                TextColumn::make('servings')
                    ->placeholder('—'),
                TextColumn::make('source')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'quick' => 'success',
                        'cook' => 'primary',
                        default => 'gray',
                    })
                    ->placeholder('—'),
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
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('source')
                    ->options([
                        'cook' => 'Cook mode',
                        'quick' => 'Quick time',
                    ]),
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
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCookSessions::route('/'),
            'view' => Pages\ViewCookSession::route('/{record}'),
            'edit' => Pages\EditCookSession::route('/{record}/edit'),
        ];
    }
}