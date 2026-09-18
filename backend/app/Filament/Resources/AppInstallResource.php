<?php

namespace App\Filament\Resources;

use App\Filament\Resources\AppInstallResource\Pages;
use App\Models\AppInstall;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Enums\FontFamily;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class AppInstallResource extends Resource
{
    protected static ?string $model = AppInstall::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDevicePhoneMobile;

    protected static string|UnitEnum|null $navigationGroup = 'Activity';

    protected static bool $globallySearchable = false;

    public static function getModelLabel(): string
    {
        return 'App install';
    }

    public static function getPluralModelLabel(): string
    {
        return 'App installs';
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
                        TextEntry::make('install_id')
                            ->monospace(),
                        TextEntry::make('user.name')
                            ->label('User')
                            ->placeholder('Guest'),
                        TextEntry::make('platform')
                            ->badge(),
                        TextEntry::make('app_version')
                            ->label('App version')
                            ->placeholder('—'),
                        TextEntry::make('created_at')
                            ->label('First seen')
                            ->dateTime(),
                        TextEntry::make('updated_at')
                            ->label('Last seen')
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
                TextColumn::make('install_id')
                    ->fontFamily(FontFamily::Mono)
                    ->limit(8)
                    ->searchable(),
                TextColumn::make('user.name')
                    ->label('User')
                    ->placeholder('Guest'),
                TextColumn::make('platform')
                    ->badge(),
                TextColumn::make('app_version')
                    ->label('Version')
                    ->placeholder('—'),
                TextColumn::make('created_at')
                    ->label('First seen')
                    ->dateTime()
                    ->sortable(),
                TextColumn::make('updated_at')
                    ->label('Last seen')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('platform')
                    ->options([
                        'android' => 'Android',
                        'ios' => 'iOS',
                        'web' => 'Web',
                    ]),
                Filter::make('active_7d')
                    ->label('Active last 7 days')
                    ->query(fn (Builder $query): Builder => $query->where('updated_at', '>=', now()->subDays(7))),
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
            'index' => Pages\ListAppInstalls::route('/'),
            'view' => Pages\ViewAppInstall::route('/{record}'),
        ];
    }
}
