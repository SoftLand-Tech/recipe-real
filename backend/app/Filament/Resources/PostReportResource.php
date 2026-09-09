<?php

namespace App\Filament\Resources;

use App\Filament\Resources\PostReportResource\Pages;
use App\Models\PostReport;
use App\Services\ModerationService;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class PostReportResource extends Resource
{
    protected static ?string $model = PostReport::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedFlag;

    protected static string|UnitEnum|null $navigationGroup = 'Community';

    protected static ?int $navigationSort = 10;

    /**
     * Hidden from the sidebar — both report queues live together on the
     * combined Reports page. Routes (list/view) stay registered for the
     * view links and the Posts/Comments relation managers.
     */
    public static function shouldRegisterNavigation(): bool
    {
        return false;
    }

    public static function getModelLabel(): string
    {
        return 'Post report';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Post reports';
    }

    public static function getNavigationBadge(): ?string
    {
        $count = PostReport::query()->count();

        return $count > 0 ? (string) $count : null;
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
                        TextEntry::make('post.user.name')
                            ->label('Post author'),
                        TextEntry::make('user.name')
                            ->label('Reported by'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                        TextEntry::make('post.id')
                            ->label('Post ID'),
                    ]),
                Section::make('Reported post')
                    ->schema([
                        TextEntry::make('post.body')
                            ->hiddenLabel()
                            ->columnSpanFull(),
                    ]),
                Section::make('Report reason')
                    ->schema([
                        TextEntry::make('reason')
                            ->hiddenLabel()
                            ->placeholder('No reason given')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with(['post.user', 'user']))
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('post.body')
                    ->label('Post')
                    ->limit(50)
                    ->searchable(),
                TextColumn::make('post.user.name')
                    ->label('Author')
                    ->searchable(),
                TextColumn::make('user.name')
                    ->label('Reported by')
                    ->searchable(),
                TextColumn::make('reason')
                    ->limit(40)
                    ->placeholder('—'),
                TextColumn::make('created_at')
                    ->since()
                    ->sortable(),
            ])
            ->filters([])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                // Dismiss: the report was reviewed and the post stays up.
                DeleteAction::make()
                    ->label('Dismiss')
                    ->modalHeading('Dismiss this report')
                    ->modalDescription('The post stays up. Only this report row is removed.')
                    ->successNotificationTitle('Report dismissed'),
                Action::make('removePost')
                    ->label('Remove post')
                    ->icon('heroicon-o-trash')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Remove this post?')
                    ->modalDescription('The post and ALL its reports are deleted. The author is notified in their inbox.')
                    ->form([
                        Textarea::make('reason')
                            ->label('Reason (sent to the author)')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (PostReport $record, array $data): void {
                        $post = $record->post;
                        if ($post === null) {
                            $record->delete();
                        } else {
                            app(ModerationService::class)->removePost($post, $data['reason'] ?? null);
                        }
                    })
                    ->successNotificationTitle('Post removed, author notified'),
                Action::make('banAuthor')
                    ->label('Ban author')
                    ->icon('heroicon-o-no-symbol')
                    ->color('danger')
                    ->requiresConfirmation()
                    ->modalHeading('Ban this author?')
                    ->modalDescription('The account is suspended immediately, all its API tokens are revoked, and the post is removed with an inbox notice.')
                    ->form([
                        Textarea::make('reason')
                            ->label('Reason (sent to the author)')
                            ->rows(2)
                            ->maxLength(500),
                    ])
                    ->action(function (PostReport $record, array $data): void {
                        $post = $record->post;
                        $reason = $data['reason'] ?? null;
                        $service = app(ModerationService::class);
                        if ($post !== null) {
                            if ($post->user !== null) {
                                $service->banUser($post->user, $reason);
                            }
                            $service->removePost($post->fresh(), $reason);
                        }
                    })
                    ->successNotificationTitle('Author banned'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->label('Dismiss selected'),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPostReports::route('/'),
            'view' => Pages\ViewPostReport::route('/{record}'),
        ];
    }
}
