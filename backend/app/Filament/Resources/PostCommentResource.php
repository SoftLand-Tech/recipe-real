<?php

namespace App\Filament\Resources;

use BackedEnum;
use UnitEnum;

use App\Filament\Resources\PostCommentResource\Pages;
use App\Models\PostComment;
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
use Filament\Tables\Table;

class PostCommentResource extends Resource
{
    protected static ?string $model = PostComment::class;

    protected static string | BackedEnum | null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    protected static string | UnitEnum | null $navigationGroup = 'Community';

    public static function getModelLabel(): string
    {
        return 'Post comment';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Post comments';
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
                TextColumn::make('created_at')
                    ->since()
                    ->sortable(),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
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
}