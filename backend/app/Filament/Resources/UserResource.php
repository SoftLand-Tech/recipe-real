<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class UserResource extends Resource
{
    protected static ?string $model = User::class;

    protected static string | BackedEnum | null $navigationIcon = Heroicon::OutlinedUsers;

    protected static string | UnitEnum | null $navigationGroup = 'People';

    protected static ?string $recordTitleAttribute = 'name';

    public static function getNavigationLabel(): string
    {
        return 'Users';
    }

    public static function getModelLabel(): string
    {
        return 'User';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('display_name')
                    ->label('Display name')
                    ->maxLength(255),
                TextInput::make('avatar_url')
                    ->label('Avatar URL')
                    ->url()
                    ->maxLength(500),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('name'),
                        TextEntry::make('display_name')
                            ->placeholder('—'),
                        TextEntry::make('email'),
                        TextEntry::make('auth_method')
                            ->label('Sign-in method')
                            ->state(fn (User $record): string => $record->google_sub !== null ? 'Google' : 'Password'),
                        TextEntry::make('id')
                            ->label('Subscription')
                            ->state(fn (User $record): string => $record->isPremium() ? 'Premium' : 'Free'),
                        TextEntry::make('skill_level'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with('subscriptions'))
            ->columns([
                ImageColumn::make('avatar_url')
                    ->label('')
                    ->circular(),
                TextColumn::make('name')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('display_name')
                    ->label('Display name')
                    ->searchable()
                    ->placeholder('—'),
                TextColumn::make('email')
                    ->searchable()
                    ->sortable(),
                TextColumn::make('google_sub')
                    ->label('Sign-in method')
                    ->formatStateUsing(fn (?string $state): string => $state !== null ? 'Google' : 'Password')
                    ->badge()
                    ->color(fn (?string $state): string => $state !== null ? 'primary' : 'gray'),
                TextColumn::make('id')
                    ->label('Subscription')
                    ->state(fn (User $record): string => $record->isPremium() ? 'Premium' : 'Free')
                    ->badge()
                    ->color(fn (User $record): string => $record->isPremium() ? 'success' : 'gray'),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([])
            ->recordActions([
                EditAction::make(),
                ViewAction::make(),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            UserResource\RelationManagers\PostsRelationManager::class,
            UserResource\RelationManagers\RecipesRelationManager::class,
            UserResource\RelationManagers\CookSessionsRelationManager::class,
            UserResource\RelationManagers\RecipeNotesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'view' => Pages\ViewUser::route('/{record}'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}