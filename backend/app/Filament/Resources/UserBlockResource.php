<?php

namespace App\Filament\Resources;

use App\Filament\Resources\UserBlockResource\Pages;
use App\Models\UserBlock;
use BackedEnum;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class UserBlockResource extends Resource
{
    protected static ?string $model = UserBlock::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedEyeSlash;

    protected static string|UnitEnum|null $navigationGroup = 'Community';

    protected static ?int $navigationSort = 4;

    protected static ?string $slug = 'blocks';

    public static function getModelLabel(): string
    {
        return 'Block';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Blocks';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('blocker.name')
                            ->label('Blocker'),
                        TextEntry::make('blocked.name')
                            ->label('Blocked user'),
                        TextEntry::make('blocker.email')
                            ->label('Blocker email'),
                        TextEntry::make('blocked.email')
                            ->label('Blocked email'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with(['blocker', 'blocked']))
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('blocker.name')
                    ->label('Blocker')
                    ->searchable(),
                TextColumn::make('blocked.name')
                    ->label('Blocked user')
                    ->searchable(),
                TextColumn::make('created_at')
                    ->since()
                    ->sortable(),
            ])
            ->filters([])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                // Unblock on the user's behalf (e.g. ban appeal upheld).
                DeleteAction::make()
                    ->label('Unblock')
                    ->modalHeading('Remove this block?')
                    ->modalDescription('The blocker will see the blocked user\'s content again.')
                    ->successNotificationTitle('Block removed'),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUserBlocks::route('/'),
            'view' => Pages\ViewUserBlock::route('/{record}'),
        ];
    }
}
