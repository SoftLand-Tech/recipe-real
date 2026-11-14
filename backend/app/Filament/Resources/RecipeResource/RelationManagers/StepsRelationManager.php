<?php

namespace App\Filament\Resources\RecipeResource\RelationManagers;

use Filament\Actions\BulkActionGroup;
use Filament\Actions\CreateAction;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class StepsRelationManager extends RelationManager
{
    protected static string $relationship = 'recipeSteps';

    public static function getModelLabel(): string
    {
        return 'Step';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Steps';
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextInput::make('step_number')
                            ->numeric()
                            ->required(),
                        Select::make('step_type')
                            ->options([
                                'active' => 'Active',
                                'passive' => 'Passive',
                                'cleanup' => 'Cleanup',
                            ])
                            ->default('active')
                            ->required(),
                    ]),
                Textarea::make('description')
                    ->required(),
                Textarea::make('description_ar')
                    ->label('Description (Arabic)'),
                Grid::make(3)
                    ->schema([
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

    public function table(Table $table): Table
    {
        return $table
            ->columns([
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
            ->headerActions([
                CreateAction::make(),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ])
            ->defaultSort('step_number');
    }
}
