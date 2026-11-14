<?php

namespace App\Filament\Resources\RecipeResource\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ToggleColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class NotesRelationManager extends RelationManager
{
    protected static string $relationship = 'notes';

    public static function getModelLabel(): string
    {
        return 'Note';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Notes';
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Textarea::make('body')
                    ->required()
                    ->rows(4),
                Toggle::make('is_public')
                    ->default(true),
            ]);
    }

    public function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('user.name')
                    ->label('User'),
                TextColumn::make('body')
                    ->limit(60),
                ToggleColumn::make('is_public')
                    ->label('Public'),
                TextColumn::make('created_at')
                    ->since(),
            ])
            ->filters([
                TernaryFilter::make('is_public')
                    ->label('Visibility'),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }
}
