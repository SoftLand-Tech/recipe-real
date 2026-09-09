<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\UserResource\Pages;
use App\Models\User;
use App\Services\ModerationService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
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
                        TextEntry::make('banned_at')
                            ->label('Suspended at')
                            ->dateTime()
                            ->placeholder('—'),
                        TextEntry::make('ban_reason')
                            ->label('Suspension reason')
                            ->placeholder('—'),
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
                TextColumn::make('banned_at')
                    ->label('Suspended')
                    ->state(fn (?User $record): string => $record !== null && $record->isBanned() ? 'Banned' : 'Active')
                    ->badge()
                    ->color(fn (?User $record): string => $record !== null && $record->isBanned() ? 'danger' : 'success'),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                TernaryFilter::make('banned_at')
                    ->label('Suspension status')
                    ->nullable(),
            ])
            ->recordActions([
                EditAction::make(),
                ViewAction::make(),
                Action::make('ban')
                    ->label('Ban')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Suspend this account?')
                    ->modalDescription('The user is signed out everywhere immediately and can no longer sign in or use the app.')
                    ->visible(fn (User $record): bool => ! $record->isBanned())
                    ->form([
                        Textarea::make('reason')
                            ->label('Reason (sent to the user)')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (User $record, array $data): void {
                        app(ModerationService::class)->banUser($record, $data['reason'] ?? null);
                    })
                    ->successNotificationTitle('Account suspended'),
                Action::make('unban')
                    ->label('Unban')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Lift this suspension?')
                    ->modalDescription('The user can sign in again (their old tokens stay revoked).')
                    ->visible(fn (User $record): bool => $record->isBanned())
                    ->action(function (User $record): void {
                        app(ModerationService::class)->unbanUser($record);
                    })
                    ->successNotificationTitle('Suspension lifted'),
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