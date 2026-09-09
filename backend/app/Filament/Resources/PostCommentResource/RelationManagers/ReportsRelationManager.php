<?php

namespace App\Filament\Resources\PostCommentResource\RelationManagers;

use App\Filament\Resources\CommentReportResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class ReportsRelationManager extends RelationManager
{
    protected static string $relationship = 'reports';

    protected static ?string $relatedResource = CommentReportResource::class;

    public function table(Table $table): Table
    {
        return CommentReportResource::table($table);
    }
}
