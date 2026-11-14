<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RecipeStepResource\Pages;
use App\Models\RecipeStep;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class RecipeStepResource extends Resource
{
    protected static ?string $model = RecipeStep::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedListBullet;

    protected static string|UnitEnum|null $navigationGroup = 'Content';

    protected static ?string $recordTitleAttribute = 'description';

    public static function getModelLabel(): string
    {
        return 'Recipe step';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Recipe steps';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        Select::make('recipe_id')
                            ->label('Recipe')
                            ->relationship('recipe', 'title')
                            ->searchable()
                            ->preload()
                            ->required(),
                        TextInput::make('step_number')
                            ->numeric()
                            ->required(),
                    ]),
                Textarea::make('description')
                    ->required(),
                Textarea::make('description_ar')
                    ->label('Description (Arabic)'),
                Grid::make(3)
                    ->schema([
                        Select::make('step_type')
                            ->options([
                                'active' => 'Active',
                                'passive' => 'Passive',
                                'cleanup' => 'Cleanup',
                            ])
                            ->default('active')
                            ->required(),
                        TextInput::make('publisher_minutes')
                            ->label('Publisher (min)')
                            ->numeric()
                            ->minValue(0)
                            ->nullable(),
                        TextInput::make('community_avg_minutes')
                            ->label('Community avg (min)')
                            ->numeric()
                            ->minValue(0)
                            ->nullable(),
                        TextInput::make('ai_minutes')
                            ->label('AI (min)')
                            ->numeric()
                            ->minValue(0)
                            ->nullable(),
                        TextInput::make('literal_minutes')
                            ->label('Literal (min)')
                            ->numeric()
                            ->minValue(0)
                            ->nullable(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->searchable()
                    ->limit(40),
                TextColumn::make('step_number')
                    ->sortable(),
                TextColumn::make('description')
                    ->searchable()
                    ->limit(60),
                TextColumn::make('description_ar')
                    ->label('AR')
                    ->placeholder('—')
                    ->limit(40),
                TextColumn::make('step_type')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'active' => 'primary',
                        'passive' => 'info',
                        'cleanup' => 'gray',
                        default => 'gray',
                    }),
                TextColumn::make('publisher_minutes')
                    ->label('Publisher (min)')
                    ->placeholder('—'),
                TextColumn::make('community_avg_minutes')
                    ->label('Community (min)')
                    ->placeholder('—'),
                TextColumn::make('ai_minutes')
                    ->label('AI (min)')
                    ->placeholder('—'),
                TextColumn::make('literal_minutes')
                    ->label('Literal (min)')
                    ->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('step_type')
                    ->options([
                        'active' => 'Active',
                        'passive' => 'Passive',
                        'cleanup' => 'Cleanup',
                    ]),
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

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRecipeSteps::route('/'),
            'create' => Pages\CreateRecipeStep::route('/create'),
            'edit' => Pages\EditRecipeStep::route('/{record}/edit'),
        ];
    }
}
