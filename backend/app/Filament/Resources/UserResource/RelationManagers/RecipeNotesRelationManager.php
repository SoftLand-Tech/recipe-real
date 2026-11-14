<?php

namespace App\Filament\Resources\UserResource\RelationManagers;

use App\Filament\Resources\RecipeNoteResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class RecipeNotesRelationManager extends RelationManager
{
    protected static string $relationship = 'recipeNotes';

    protected static ?string $relatedResource = RecipeNoteResource::class;

    public function form(Schema $schema): Schema
    {
        return RecipeNoteResource::form($schema);
    }

    public function table(Table $table): Table
    {
        return RecipeNoteResource::table($table);
    }
}
