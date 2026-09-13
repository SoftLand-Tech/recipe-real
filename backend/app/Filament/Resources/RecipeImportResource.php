<?php

namespace App\Filament\Resources;

use App\Filament\Resources\RecipeImportResource\Pages;
use App\Jobs\RebuildSearchIndex;
use App\Models\RecipeImport;
use App\Services\RecipeImport\RecipeContentRejected;
use App\Services\RecipeImport\RecipeDraftMapper;
use App\Services\RecipeImport\RecipeImportService;
use App\Services\RecipeImport\RecipeImportStorage;
use App\Services\RecipeImport\RecipePublisher;
use BackedEnum;
use Closure;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TagsInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Fieldset;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Schema;
use Filament\Support\Enums\FontFamily;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\UploadedFile;
use UnitEnum;

class RecipeImportResource extends Resource
{
    protected static ?string $model = RecipeImport::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedSparkles;

    protected static string|UnitEnum|null $navigationGroup = 'Content';

    protected static ?string $recordTitleAttribute = 'id';

    public static function getModelLabel(): string
    {
        return 'Recipe import';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Recipe imports';
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->schema([
            Grid::make(2)
                ->schema([
                    TextInput::make('source_url')
                        ->label('Public recipe URL (optional)')
                        ->url()
                        ->requiredWithout('primary_file')
                        ->maxLength(2000)
                        ->helperText('Paste a TikTok, Instagram, Facebook, X, YouTube, or recipe page URL.')
                        ->columnSpanFull(),
                    FileUpload::make('primary_file')
                        ->label('Primary video or image')
                        ->acceptedFileTypes([
                            'image/jpeg',
                            'image/png',
                            'image/webp',
                            'image/heic',
                            'video/mp4',
                            'video/quicktime',
                            'video/x-m4v',
                            'video/webm',
                        ])
                        ->maxSize((int) config('recipereal.imports.max_video_mb', 100) * 1024)
                        ->rules([
                            fn (): Closure => function (string $attribute, mixed $value, Closure $fail): void {
                                if (! $value instanceof UploadedFile) {
                                    return;
                                }

                                $maxMb = str_starts_with((string) $value->getMimeType(), 'video/')
                                    ? (int) config('recipereal.imports.max_video_mb', 100)
                                    : (int) config('recipereal.imports.max_image_mb', 8);

                                if (($value->getSize() ?: 0) > ($maxMb * 1024 * 1024)) {
                                    $fail('This file exceeds the configured limit of '.$maxMb.' MB.');
                                }
                            },
                        ])
                        ->storeFiles(false)
                        ->requiredWithout('source_url')
                        ->helperText('Upload a recipe video or image. Videos may be up to '.config('recipereal.imports.max_video_mb', 100).' MB; images up to '.config('recipereal.imports.max_image_mb', 8).' MB.')
                        ->columnSpanFull(),
                    FileUpload::make('extra_images')
                        ->label('Additional recipe images (optional)')
                        ->multiple()
                        ->maxFiles((int) config('recipereal.imports.max_images', 6))
                        ->acceptedFileTypes([
                            'image/jpeg',
                            'image/png',
                            'image/webp',
                            'image/heic',
                        ])
                        ->maxSize((int) config('recipereal.imports.max_image_mb', 8) * 1024)
                        ->storeFiles(false)
                        ->helperText('Add up to '.config('recipereal.imports.max_images', 6).' extra images for visual extraction.')
                        ->columnSpanFull(),
                    Select::make('provider')
                        ->options(fn (): array => array_combine(
                            $keys = array_keys((array) config('recipereal.ai.providers', [])),
                            $keys,
                        ) ?: [])
                        ->default(config('recipereal.ai.default', 'custom'))
                        ->required(),
                ])
                ->visibleOn('create'),
            Fieldset::make('Review extracted recipe')
                ->visibleOn('edit')
                ->schema([
                    Grid::make(2)->schema([
                        TextInput::make('draft.title')
                            ->label('Title')
                            ->required()
                            ->maxLength(255),
                        TextInput::make('draft.title_ar')
                            ->label('Title (Arabic)')
                            ->maxLength(255),
                        Textarea::make('draft.description')
                            ->label('Description')
                            ->rows(3)
                            ->columnSpanFull(),
                        TextInput::make('draft.servings')
                            ->numeric()
                            ->minValue(1)
                            ->maxValue(50),
                        TextInput::make('draft.total_time_minutes')
                            ->label('Total time (min)')
                            ->numeric()
                            ->required()
                            ->minValue(1)
                            ->maxValue(1440),
                        TextInput::make('draft.prep_time_minutes')
                            ->label('Prep time (min)')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1440),
                        TextInput::make('draft.cook_time_minutes')
                            ->label('Cook time (min)')
                            ->numeric()
                            ->minValue(0)
                            ->maxValue(1440),
                        TextInput::make('draft.category')
                            ->maxLength(255),
                        TagsInput::make('draft.keywords'),
                        TextInput::make('draft.cover_image_url')
                            ->label('Cover image URL')
                            ->url()
                            ->maxLength(500)
                            ->columnSpanFull(),
                    ]),
                    Repeater::make('draft.ingredients')
                        ->label('Ingredients')
                        ->schema([
                            TextInput::make('raw')
                                ->required()
                                ->maxLength(300)
                                ->columnSpanFull(),
                            TextInput::make('quantity')->numeric(),
                            TextInput::make('quantity_display'),
                            TextInput::make('unit'),
                            TextInput::make('item'),
                            TextInput::make('prep'),
                            TextInput::make('group'),
                        ])
                        ->columns(2)
                        ->minItems(1)
                        ->maxItems(60)
                        ->reorderable(),
                    Repeater::make('draft.steps')
                        ->label('Steps')
                        ->schema([
                            Textarea::make('description')
                                ->required()
                                ->rows(3)
                                ->columnSpanFull(),
                            Textarea::make('description_ar')
                                ->label('Description (Arabic)')
                                ->rows(2)
                                ->columnSpanFull(),
                            TextInput::make('minutes_estimated')
                                ->label('Estimated minutes')
                                ->numeric()
                                ->minValue(0)
                                ->maxValue(1440),
                            TextInput::make('literal_minutes')
                                ->label('Literal minutes')
                                ->numeric()
                                ->minValue(0)
                                ->maxValue(1440),
                            Select::make('step_type')
                                ->options([
                                    'active' => 'Active',
                                    'passive' => 'Passive',
                                    'cleanup' => 'Cleanup',
                                ])
                                ->default('active')
                                ->required(),
                        ])
                        ->columns(3)
                        ->minItems(1)
                        ->maxItems(40)
                        ->reorderable(),
                ]),
        ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->schema([
            Grid::make(3)->schema([
                TextEntry::make('status')->badge(),
                TextEntry::make('stage')->badge(),
                TextEntry::make('progress')->suffix('%'),
                TextEntry::make('source_platform')->placeholder('—'),
                TextEntry::make('provider')->placeholder('—'),
                TextEntry::make('provider_model')->placeholder('—'),
                TextEntry::make('source_url')->url(fn ($state): ?string => $state ?: null)->openUrlInNewTab()->columnSpanFull(),
                TextEntry::make('error_message')->columnSpanFull()->placeholder('—'),
            ]),
            Fieldset::make('Extracted recipe')->schema([
                Grid::make(2)->schema([
                    TextEntry::make('draft.title')->label('Title')->placeholder('—'),
                    TextEntry::make('draft.title_ar')->label('Title (Arabic)')->placeholder('—'),
                    TextEntry::make('draft.description')->columnSpanFull()->placeholder('—'),
                    TextEntry::make('draft.servings')->placeholder('—'),
                    TextEntry::make('draft.total_time_minutes')->label('Total time (min)')->placeholder('—'),
                    TextEntry::make('draft.prep_time_minutes')->label('Prep time (min)')->placeholder('—'),
                    TextEntry::make('draft.cook_time_minutes')->label('Cook time (min)')->placeholder('—'),
                    TextEntry::make('draft.category')->placeholder('—'),
                    TextEntry::make('draft.keywords')->formatStateUsing(fn ($state): string => is_array($state) ? implode(', ', $state) : ($state ?? '—'))->placeholder('—'),
                    TextEntry::make('draft.cover_image_url')->label('Cover image URL')->columnSpanFull()->placeholder('—'),
                ]),
                RepeatableEntry::make('draft.ingredients')
                    ->label('Ingredients')
                    ->columnSpanFull()
                    ->placeholder('No ingredients extracted yet.')
                    ->schema([
                        TextEntry::make('raw')->label('Ingredient')->columnSpanFull(),
                        TextEntry::make('quantity')->placeholder('—'),
                        TextEntry::make('unit')->placeholder('—'),
                        TextEntry::make('item')->placeholder('—'),
                    ]),
                RepeatableEntry::make('draft.steps')
                    ->label('Steps')
                    ->columnSpanFull()
                    ->placeholder('No steps extracted yet.')
                    ->schema([
                        TextEntry::make('description')->label('Step')->columnSpanFull(),
                        TextEntry::make('minutes_estimated')->label('Est. min')->placeholder('—'),
                        TextEntry::make('step_type')->placeholder('—'),
                    ]),
            ]),
            Fieldset::make('Debug')->schema([
                TextEntry::make('warnings')
                    ->formatStateUsing(fn ($state): string => is_array($state) ? (json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—') : ($state ?? '—'))
                    ->fontFamily(FontFamily::Mono)
                    ->columnSpanFull(),
                TextEntry::make('confidence')
                    ->formatStateUsing(fn ($state): string => is_array($state) ? (json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) ?: '—') : ($state ?? '—'))
                    ->fontFamily(FontFamily::Mono)
                    ->columnSpanFull(),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('status')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        'ready' => 'success',
                        'processing', 'queued' => 'warning',
                        'published' => 'info',
                        'failed' => 'danger',
                        default => 'gray',
                    }),
                TextColumn::make('source_platform')->placeholder('URL'),
                TextColumn::make('source_url')->limit(55)->searchable(),
                TextColumn::make('provider')->placeholder('—'),
                TextColumn::make('progress')->suffix('%'),
                TextColumn::make('requester.name')->label('Requested by')->placeholder('Admin'),
                TextColumn::make('created_at')->dateTime()->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')->options([
                    'queued' => 'Queued',
                    'processing' => 'Processing',
                    'ready' => 'Ready for review',
                    'failed' => 'Failed',
                    'published' => 'Published',
                ]),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([
                ViewAction::make(),
                EditAction::make()
                    ->visible(fn (RecipeImport $record): bool => $record->status === 'ready'),
                Action::make('retry')
                    ->label('Retry')
                    ->icon(Heroicon::OutlinedArrowPath)
                    ->visible(fn (RecipeImport $record): bool => in_array($record->status, ['failed', 'ready'], true))
                    ->action(fn (RecipeImport $record): RecipeImport => app(RecipeImportService::class)->retry($record)),
                Action::make('publish')
                    ->label('Publish')
                    ->icon(Heroicon::OutlinedCheck)
                    ->color('success')
                    ->requiresConfirmation()
                    ->visible(fn (RecipeImport $record): bool => $record->status === 'ready')
                    ->action(function (RecipeImport $record): void {
                        $input = app(RecipeDraftMapper::class)->toPublishInput($record->draft ?: []);
                        if (empty($input['title']) || empty($input['ingredients']) || empty($input['steps']) || empty($input['estimated_minutes'])) {
                            Notification::make()
                                ->danger()
                                ->title('Draft is incomplete')
                                ->body('Fill the required fields in the recipe editor before publishing.')
                                ->send();

                            return;
                        }

                        try {
                            $publisher = app(RecipePublisher::class);
                            $publisher->publish(auth()->user(), $input, $record, auth()->user());
                            app(RecipeImportStorage::class)->deleteAssets($record->source_assets ?: []);
                            $record->update(['source_assets' => []]);
                            RebuildSearchIndex::dispatch();
                            Notification::make()->success()->title('Recipe published')->send();
                        } catch (RecipeContentRejected $e) {
                            Notification::make()
                                ->danger()
                                ->title('Content rejected')
                                ->body('Blocked terms: '.implode(', ', $e->terms))
                                ->send();
                        }
                    }),
                DeleteAction::make()
                    ->before(function (RecipeImport $record): void {
                        app(RecipeImportStorage::class)->deleteAssets($record->source_assets ?: []);
                    })
                    ->visible(fn (RecipeImport $record): bool => $record->status !== 'published'),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->before(function (DeleteBulkAction $action): void {
                            foreach ($action->getSelectedRecords() as $record) {
                                app(RecipeImportStorage::class)->deleteAssets($record->source_assets ?: []);
                            }
                        }),
                ]),
            ]);
    }

    public static function canEdit(Model $record): bool
    {
        return $record instanceof RecipeImport && $record->status === 'ready';
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListRecipeImports::route('/'),
            'create' => Pages\CreateRecipeImport::route('/create'),
            'view' => Pages\ViewRecipeImport::route('/{record}'),
            'edit' => Pages\EditRecipeImport::route('/{record}/edit'),
        ];
    }
}
