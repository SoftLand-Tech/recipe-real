<?php

namespace App\Filament\Resources\UserResource\RelationManagers;

use App\Filament\Resources\CookSessionResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class CookSessionsRelationManager extends RelationManager
{
    protected static string $relationship = 'cookSessions';

    protected static ?string $relatedResource = CookSessionResource::class;

    public function form(Schema $schema): Schema
    {
        return CookSessionResource::form($schema);
    }

    public function table(Table $table): Table
    {
        return CookSessionResource::table($table);
    }
}
