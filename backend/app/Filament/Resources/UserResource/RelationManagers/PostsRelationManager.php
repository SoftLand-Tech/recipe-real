<?php

namespace App\Filament\Resources\UserResource\RelationManagers;

use App\Filament\Resources\PostResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class PostsRelationManager extends RelationManager
{
    protected static string $relationship = 'posts';

    protected static ?string $relatedResource = PostResource::class;

    public function form(Schema $schema): Schema
    {
        return PostResource::form($schema);
    }

    public function table(Table $table): Table
    {
        return PostResource::table($table);
    }
}
