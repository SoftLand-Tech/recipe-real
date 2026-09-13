<?php

namespace App\Filament\Resources\RecipeImportResource\Pages;

use App\Filament\Resources\RecipeImportResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListRecipeImports extends ListRecords
{
    protected static string $resource = RecipeImportResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()
                ->label('New recipe import'),
        ];
    }
}
