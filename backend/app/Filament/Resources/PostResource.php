<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\PostResource\Pages;
use App\Filament\Resources\PostResource\RelationManagers\CommentsRelationManager;
use App\Filament\Resources\PostResource\RelationManagers\LikesRelationManager;
use App\Filament\Resources\PostResource\RelationManagers\ReportsRelationManager;
use App\Models\Post;
use App\Services\ModerationService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;

class PostResource extends Resource
{
    protected static ?string $model = Post::class;

    protected static string | BackedEnum | null $navigationIcon = Heroicon::OutlinedNewspaper;

    protected static string | UnitEnum | null $navigationGroup = 'Community';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'body';

    public static function getModelLabel(): string
    {
        return 'Post';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Posts';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(1)
                    ->schema([
                        TextInput::make('image_url')
                            ->label('Image URL')
                            ->url()
                            ->nullable(),
                    ]),
                Textarea::make('body')
                    ->required()
                    ->rows(5),
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
                        TextEntry::make('likes_count')
                            ->label('Likes'),
                        TextEntry::make('comments_count')
                            ->label('Comments'),
                        TextEntry::make('recipe.title')
                            ->label('Recipe')
                            ->placeholder('—'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                    ]),
                TextEntry::make('body')
                    ->columnSpanFull(),
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
                TextColumn::make('body')
                    ->searchable()
                    ->limit(60),
                ImageColumn::make('image_url')
                    ->label('Image')
                    ->circular(),
                TextColumn::make('likes_count')
                    ->label('Likes')
                    ->counts('likes')
                    ->sortable(),
                TextColumn::make('comments_count')
                    ->label('Comments')
                    ->counts('comments')
                    ->sortable(),
                TextColumn::make('reports_count')
                    ->label('Reports')
                    ->counts('reports')
                    ->sortable()
                    ->badge()
                    ->color(fn ($state): string => ((int) $state) > 0 ? 'danger' : 'gray'),
                TextColumn::make('created_at')
                    ->since()
                    ->sortable(),
            ])
            ->filters([
                Filter::make('reported')
                    ->label('Reported only')
                    ->query(fn ($query) => $query->has('reports')),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                Action::make('dismissReports')
                    ->label('Dismiss reports')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Dismiss all reports on this post?')
                    ->modalDescription('The post stays up.')
                    ->visible(fn (Post $record): bool => $record->reports()->exists())
                    ->action(fn (Post $record): int => app(ModerationService::class)->dismissPostReports($record))
                    ->successNotificationTitle('Reports dismissed'),
                Action::make('removeWithNotice')
                    ->label('Remove + notify')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Remove this post?')
                    ->modalDescription('The post is deleted and the author is notified in their inbox.')
                    ->form([
                        Textarea::make('reason')
                            ->label('Reason (sent to the author)')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (Post $record, array $data): void {
                        app(ModerationService::class)->removePost($record, $data['reason'] ?? null);
                    })
                    ->successNotificationTitle('Post removed, author notified'),
                DeleteAction::make(),
            ]);
    }

    public static function getRelations(): array
    {
        return [
            ReportsRelationManager::class,
            CommentsRelationManager::class,
            LikesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPosts::route('/'),
            'view' => Pages\ViewPost::route('/{record}'),
        ];
    }
}