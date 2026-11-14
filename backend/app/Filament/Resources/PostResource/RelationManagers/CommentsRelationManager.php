<?php

namespace App\Filament\Resources\PostResource\RelationManagers;

use App\Filament\Resources\PostCommentResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class CommentsRelationManager extends RelationManager
{
    protected static string $relationship = 'comments';

    protected static ?string $relatedResource = PostCommentResource::class;

    public function form(Schema $schema): Schema
    {
        return PostCommentResource::form($schema);
    }

    public function table(Table $table): Table
    {
        return PostCommentResource::table($table);
    }
}
