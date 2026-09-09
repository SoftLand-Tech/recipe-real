<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RecipeViewResource\Pages;
use App\Models\RecipeView;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

class RecipeViewResource extends Resource
{
    protected static ?string $model = RecipeView::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedViewfinderCircle;

    protected static string|UnitEnum|null $navigationGroup = 'Activity';

    public static function getModelLabel(): string
    {
        return 'Recipe view';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Recipe views';
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
                        TextEntry::make('user.name')
                            ->label('User'),
                        TextEntry::make('recipe.title')
                            ->label('Recipe'),
                        TextEntry::make('month_key'),
                        TextEntry::make('created_at')
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
                TextColumn::make('user.name')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->searchable()
                    ->limit(50),
                TextColumn::make('month_key')
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                Filter::make('month_key')
                    ->schema([TextInput::make('month_key')->label('Month key (YYYY-MM)')])
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['month_key'] ?? null, fn (Builder $query, $month) => $query->where('month_key', $month))),
            ])
            ->defaultSort('id', 'desc')
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
            'index' => Pages\ListRecipeViews::route('/'),
            'view' => Pages\ViewRecipeView::route('/{record}'),
        ];
    }
}
