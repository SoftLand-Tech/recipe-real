<?php

namespace App\Filament\Resources\RecipeImportResource\Pages;

use App\Filament\Resources\RecipeImportResource;
use App\Models\User;
use App\Services\RecipeImport\RecipeImportService;
use Filament\Resources\Pages\CreateRecord;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;

class CreateRecipeImport extends CreateRecord
{
    protected static string $resource = RecipeImportResource::class;

    protected function handleRecordCreation(array $data): Model
    {
        $user = auth()->user();
        abort_unless($user instanceof User, 403);

        $primary = $data['primary_file'] ?? null;
        $extras = $data['extra_images'] ?? [];
        $extras = is_array($extras)
            ? array_values(array_filter($extras, fn (mixed $file): bool => $file instanceof UploadedFile))
            : [];

        return app(RecipeImportService::class)->createFromFiles(
            $user,
            isset($data['source_url']) ? (string) $data['source_url'] : null,
            isset($data['provider']) ? (string) $data['provider'] : null,
            $primary instanceof UploadedFile ? $primary : null,
            $extras,
        );
    }

    protected function getCreatedNotificationTitle(): ?string
    {
        return 'Recipe import queued';
    }
}
