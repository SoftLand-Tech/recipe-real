<?php

namespace App\Filament\Widgets;

use App\Models\Post;
use Filament\Actions\DeleteAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class LatestPostsWidget extends TableWidget
{
    protected static ?int $sort = 6;

    protected int | string | array $columnSpan = 'full';

    public function table(Table $table): Table
    {
        return $table
            ->query(Post::query()->latest())
            ->poll('30s')
            ->columns([
                TextColumn::make('user.name')
                    ->label('User')
                    ->searchable(),
                TextColumn::make('kind')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => ucfirst($state))
                    ->color(fn (string $state): string => match ($state) {
                        'try' => 'success',
                        'fail' => 'danger',
                        'question' => 'info',
                        default => 'gray',
                    }),
                TextColumn::make('body')
                    ->limit(70),
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->placeholder('—')
                    ->limit(40),
                TextColumn::make('created_at')
                    ->since(),
            ])
            ->recordActions([
                DeleteAction::make()
                    ->successNotificationTitle('Post deleted'),
            ])
            ->paginated([5, 10, 25]);
    }
}