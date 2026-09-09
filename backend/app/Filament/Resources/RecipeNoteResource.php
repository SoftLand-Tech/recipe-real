<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RecipeNoteResource\Pages;
use App\Models\RecipeNote;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ToggleColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use UnitEnum;

class RecipeNoteResource extends Resource
{
    protected static ?string $model = RecipeNote::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentText;

    protected static string|UnitEnum|null $navigationGroup = 'Content';

    public static function getModelLabel(): string
    {
        return 'Recipe note';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Recipe notes';
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
                Toggle::make('is_public')
                    ->default(true),
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
                        TextEntry::make('is_public')
                            ->label('Public')
                            ->boolean(),
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
                TextColumn::make('user.name')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->searchable()
                    ->limit(40),
                TextColumn::make('body')
                    ->limit(60),
                ToggleColumn::make('is_public')
                    ->label('Public'),
                TextColumn::make('created_at')
                    ->since()
                    ->sortable(),
            ])
            ->filters([
                TernaryFilter::make('is_public')
                    ->label('Visibility'),
            ])
            ->recordActions([
                ViewAction::make(),
                EditAction::make(),
                DeleteAction::make(),
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
            'index' => Pages\ListRecipeNotes::route('/'),
            'view' => Pages\ViewRecipeNote::route('/{record}'),
            'edit' => Pages\EditRecipeNote::route('/{record}/edit'),
        ];
    }
}
