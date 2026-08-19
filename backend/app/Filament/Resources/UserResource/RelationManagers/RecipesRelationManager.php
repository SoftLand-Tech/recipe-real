<?php

namespace App\Filament\Resources\UserResource\RelationManagers;

use App\Filament\Resources\RecipeResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class RecipesRelationManager extends RelationManager
{
    protected static string $relationship = 'recipes';

    protected static ?string $relatedResource = RecipeResource::class;

    public function form(Schema $schema): Schema
    {
        return RecipeResource::form($schema);
    }

    public function table(Table $table): Table
    {
        return RecipeResource::table($table);
    }
}