<?php

namespace App\Filament\Resources\RecipeStepResource\Pages;

use App\Filament\Resources\RecipeStepResource;
use Filament\Resources\Pages\ListRecords;

class ListRecipeSteps extends ListRecords
{
    protected static string $resource = RecipeStepResource::class;

    protected function getHeaderActions(): array
    {
        return [
            \Filament\Actions\CreateAction::make(),
        ];
    }
}