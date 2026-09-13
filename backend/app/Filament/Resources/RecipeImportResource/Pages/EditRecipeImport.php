<?php

namespace App\Filament\Resources\RecipeImportResource\Pages;

use App\Filament\Resources\RecipeImportResource;
use Filament\Resources\Pages\EditRecord;

class EditRecipeImport extends EditRecord
{
    protected static string $resource = RecipeImportResource::class;

    /**
     * Keep provider metadata and attribution while replacing only the fields
     * exposed in the review form. The editor also makes the manual correction
     * visible in the warning list returned to mobile clients.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function mutateFormDataBeforeSave(array $data): array
    {
        $draft = array_replace_recursive(
            is_array($this->record->draft) ? $this->record->draft : [],
            is_array($data['draft'] ?? null) ? $data['draft'] : [],
        );
        $warnings = array_values(array_unique(array_merge(
            is_array($draft['warnings'] ?? null) ? $draft['warnings'] : [],
            ['admin_edited'],
        )));

        $draft['warnings'] = $warnings;
        $data['draft'] = $draft;
        $data['warnings'] = $warnings;

        return $data;
    }
}
