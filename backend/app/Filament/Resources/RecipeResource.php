<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RecipeResource\Pages;
use App\Filament\Resources\RecipeResource\RelationManagers\NotesRelationManager;
use App\Filament\Resources\RecipeResource\RelationManagers\StepsRelationManager;
use App\Jobs\RebuildSearchIndex;
use App\Models\Recipe;
use App\Support\CommunityFeedCache;
use App\Support\ShareCache;
use App\Support\TypesenseSearch;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Fieldset;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\Log;
use Throwable;
use UnitEnum;

class RecipeResource extends Resource
{
    protected static ?string $model = Recipe::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static string|UnitEnum|null $navigationGroup = 'Content';

    protected static ?string $recordTitleAttribute = 'title';

    public static function getModelLabel(): string
    {
        return 'Recipe';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Recipes';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextInput::make('title')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('title_ar')
                            ->label('Title (Arabic)')
                            ->maxLength(255),
                        Textarea::make('description')
                            ->rows(3),
                        Select::make('category')
                            ->options(fn (): array => Recipe::query()
                                ->whereNotNull('category')
                                ->distinct()
                                ->orderBy('category')
                                ->pluck('category', 'category')
                                ->all())
                            ->searchable()
                            ->nullable(),
                        TextInput::make('image_url')
                            ->url()
                            ->maxLength(500),
                        TagsInput::make('keywords'),
                    ]),
                Fieldset::make('Timing')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextInput::make('publisher_time_minutes')
                                    ->label('Publisher time (min)')
                                    ->numeric()
                                    ->minValue(0)
                                    ->nullable(),
                                TextInput::make('community_avg_minutes')
                                    ->label('Community average (min)')
                                    ->numeric()
                                    ->minValue(0)
                                    ->nullable(),
                                TextInput::make('cleanup_avg_minutes')
                                    ->label('Cleanup average (min)')
                                    ->numeric()
                                    ->minValue(0)
                                    ->nullable(),
                                TextInput::make('reality_minutes')
                                    ->label('Reality (min)')
                                    ->numeric()
                                    ->minValue(0)
                                    ->nullable()
                                    ->disabled(),
                                TextInput::make('reality_source')
                                    ->disabled(),
                                TextInput::make('reality_samples')
                                    ->numeric()
                                    ->disabled(),
                            ]),
                    ]),
                Fieldset::make('Ownership')
                    ->schema([
                        Select::make('owner_id')
                            ->label('Owner')
                            ->relationship('owner', 'name')
                            ->searchable()
                            ->preload()
                            ->nullable(),
                    ]),
            ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Grid::make(2)
                    ->schema([
                        TextEntry::make('title'),
                        TextEntry::make('title_ar')
                            ->placeholder('—'),
                        TextEntry::make('category')
                            ->placeholder('—'),
                        TextEntry::make('source_type'),
                        TextEntry::make('publisher_time_minutes')
                            ->label('Publisher time (min)')
                            ->placeholder('—'),
                        TextEntry::make('community_avg_minutes')
                            ->label('Community average (min)')
                            ->placeholder('—'),
                        TextEntry::make('reality_minutes')
                            ->label('Reality (min)')
                            ->placeholder('—'),
                        TextEntry::make('reality_source')
                            ->placeholder('—'),
                        TextEntry::make('aggregated_rating')
                            ->label('Rating')
                            ->placeholder('—'),
                        TextEntry::make('review_count')
                            ->label('Reviews')
                            ->placeholder('—'),
                        TextEntry::make('owner.name')
                            ->label('Owner')
                            ->placeholder('—'),
                        TextEntry::make('created_at')
                            ->dateTime(),
                        TextEntry::make('description')
                            ->label('Description')
                            ->columnSpanFull(),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                ImageColumn::make('image_url')
                    ->label('')
                    ->circular(),
                TextColumn::make('title')
                    ->searchable()
                    ->sortable()
                    ->limit(45),
                TextColumn::make('title_ar')
                    ->label('Title (AR)')
                    ->searchable()
                    ->placeholder('—')
                    ->limit(30),
                TextColumn::make('source_type')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'user' => 'success',
                        'foodcom' => 'info',
                        default => 'gray',
                    }),
                TextColumn::make('category')
                    ->placeholder('—'),
                TextColumn::make('publisher_time_minutes')
                    ->label('Publisher (min)')
                    ->placeholder('—'),
                TextColumn::make('community_avg_minutes')
                    ->label('Community (min)')
                    ->placeholder('—'),
                TextColumn::make('reality_minutes')
                    ->label('Reality (min)')
                    ->placeholder('—'),
                TextColumn::make('reality_source')
                    ->badge()
                    ->color(fn (?string $state): string => match ($state) {
                        'community' => 'success',
                        'estimate' => 'warning',
                        default => 'gray',
                    })
                    ->placeholder('—'),
                TextColumn::make('reality_samples')
                    ->label('Samples')
                    ->placeholder('—'),
                TextColumn::make('aggregated_rating')
                    ->label('Rating')
                    ->sortable()
                    ->placeholder('—'),
                TextColumn::make('review_count')
                    ->label('Reviews')
                    ->placeholder('—'),
                TextColumn::make('steps_count')
                    ->label('Steps'),
                TextColumn::make('owner.name')
                    ->label('Owner')
                    ->placeholder('—'),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('source_type')
                    ->options([
                        'foodcom' => 'Food.com (imported)',
                        'user' => 'User (community)',
                    ]),
                SelectFilter::make('category')
                    ->options(fn (): array => Recipe::query()
                        ->whereNotNull('category')
                        ->distinct()
                        ->orderBy('category')
                        ->pluck('category', 'category')
                        ->all())
                    ->searchable(),
                Filter::make('has_community_time')
                    ->label('Has community time')
                    ->toggle()
                    ->query(fn (Builder $query) => $query->whereNotNull('community_avg_minutes')),
                Filter::make('has_reality')
                    ->label('Has reality time')
                    ->toggle()
                    ->query(fn (Builder $query) => $query->whereNotNull('reality_minutes')),
                Filter::make('rating')
                    ->schema([
                        Grid::make(2)
                            ->schema([
                                TextInput::make('min_rating')
                                    ->label('Min rating')
                                    ->numeric()
                                    ->minValue(0)
                                    ->maxValue(5),
                                TextInput::make('max_rating')
                                    ->label('Max rating')
                                    ->numeric()
                                    ->minValue(0)
                                    ->maxValue(5),
                            ]),
                    ])
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['min_rating'] ?? null, fn (Builder $query, $min) => $query->where('aggregated_rating', '>=', $min))
                        ->when($data['max_rating'] ?? null, fn (Builder $query, $max) => $query->where('aggregated_rating', '<=', $max))),
            ])
            ->recordActions([
                EditAction::make(),
                ViewAction::make(),
                DeleteAction::make()
                    // Forget BEFORE delete: the FK nulls posts.recipe_id on
                    // delete, after which attached posts can't be found for
                    // their /p card forget (see the API destroy path).
                    ->before(fn (Recipe $record) => ShareCache::forgetRecipe($record->id))
                    ->after(fn (Recipe $record) => static::afterAdminDelete([$record])),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->before(fn (EloquentCollection $records) => $records->each(
                            fn (Recipe $record) => ShareCache::forgetRecipe($record->id)
                        ))
                        ->after(fn (EloquentCollection $records) => static::afterAdminDelete($records)),
                ]),
            ]);
    }

    /**
     * Freshness tail for admin recipe deletes (single + bulk): the FTS
     * rebuild the delete always needed, plus the timing-cache bump, the
     * recipe/attached-post share forgets, and a best-effort Typesense doc
     * delete (the API destroy path does all four; the table actions must
     * not ghost rows in any of them).
     *
     * @param  iterable<Recipe>  $records
     */
    public static function afterAdminDelete(iterable $records): void
    {
        RebuildSearchIndex::dispatch();
        CommunityFeedCache::bumpTiming();

        $ids = [];
        foreach ($records as $record) {
            $ids[] = $record->id;
            ShareCache::forgetRecipe($record->id);
        }

        try {
            $typesense = app(TypesenseSearch::class);

            if ($typesense->enabled()) {
                foreach ($ids as $id) {
                    $typesense->deleteDoc((string) $id);
                }
            }
        } catch (Throwable $e) {
            Log::warning('typesense.sync.failed', [
                'op' => 'admin-delete',
                'recipe_ids' => $ids,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function getRelations(): array
    {
        return [
            StepsRelationManager::class,
            NotesRelationManager::class,
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRecipes::route('/'),
            'create' => Pages\CreateRecipe::route('/create'),
            'view' => Pages\ViewRecipe::route('/{record}'),
            'edit' => Pages\EditRecipe::route('/{record}/edit'),
        ];
    }
}
