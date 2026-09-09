<?php

namespace App\Filament\Resources\PostResource\RelationManagers;

use App\Filament\Resources\PostReportResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class ReportsRelationManager extends RelationManager
{
    protected static string $relationship = 'reports';

    protected static ?string $relatedResource = PostReportResource::class;

    public function table(Table $table): Table
    {
        return PostReportResource::table($table);
    }
}
