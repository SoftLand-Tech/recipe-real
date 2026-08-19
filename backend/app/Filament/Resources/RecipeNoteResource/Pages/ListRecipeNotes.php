<?php

namespace App\Filament\Resources\RecipeNoteResource\Pages;

use App\Filament\Resources\RecipeNoteResource;
use Filament\Resources\Pages\ListRecords;

class ListRecipeNotes extends ListRecords
{
    protected static string $resource = RecipeNoteResource::class;
}