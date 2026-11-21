<?php

namespace App\Filament\Resources\DuplicateChecksResource\Pages;

use App\Filament\Resources\DuplicateChecksResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ViewRecord;

class ViewDuplicateCheck extends ViewRecord
{
    protected static string $resource = DuplicateChecksResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('backToList')
                ->label('All duplicate checks')
                ->icon('heroicon-o-arrow-left')
                ->color('gray')
                ->url(DuplicateChecksResource::getUrl('index')),
            DuplicateChecksResource::markDuplicateAction(),
            DuplicateChecksResource::markDistinctAction(),
        ];
    }
}
