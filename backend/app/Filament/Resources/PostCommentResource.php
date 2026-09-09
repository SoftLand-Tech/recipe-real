<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\PostCommentResource\Pages;
use App\Filament\Resources\PostCommentResource\RelationManagers\ReportsRelationManager;
use App\Models\PostComment;
use App\Services\ModerationService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;

class PostCommentResource extends Resource
{
    protected static ?string $model = PostComment::class;

    protected static string | BackedEnum | null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    protected static string | UnitEnum | null $navigationGroup = 'Community';

    protected static ?int $navigationSort = 2;

    protected static ?string $slug = 'comments';

    public static function getModelLabel(): string
    {
        return 'Comment';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Comments';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Textarea::make('body')
                    ->required()
                    ->rows(4),
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
                        TextEntry::make('created_at')
                            ->dateTime(),
                    ]),
                TextEntry::make('post.body')
                    ->label('Post')
                    ->columnSpanFull(),
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
                TextColumn::make('post.body')
                    ->label('Post')
                    ->limit(40),
                TextColumn::make('body')
                    ->searchable()
                    ->limit(60),
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
                EditAction::make(),
                Action::make('dismissReports')
                    ->label('Dismiss reports')
                    ->icon('heroicon-o-check')
                    ->color('success')
                    ->requiresConfirmation()
                    ->modalHeading('Dismiss all reports on this comment?')
                    ->modalDescription('The comment stays up.')
                    ->visible(fn (PostComment $record): bool => $record->reports()->exists())
                    ->action(function (PostComment $record): void {
                        app(ModerationService::class)->dismissCommentReports($record);
                    })
                    ->successNotificationTitle('Reports dismissed'),
                Action::make('removeWithNotice')
                    ->label('Remove + notify')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Remove this comment?')
                    ->modalDescription('The comment is deleted and the author is notified in their inbox.')
                    ->form([
                        Textarea::make('reason')
                            ->label('Reason (sent to the author)')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (PostComment $record, array $data): void {
                        app(ModerationService::class)->removeComment($record, $data['reason'] ?? null);
                    })
                    ->successNotificationTitle('Comment removed, author notified'),
                DeleteAction::make(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPostComments::route('/'),
            'view' => Pages\ViewPostComment::route('/{record}'),
            'edit' => Pages\EditPostComment::route('/{record}/edit'),
        ];
    }

    public static function getRelations(): array
    {
        return [
            ReportsRelationManager::class,
        ];
    }
}