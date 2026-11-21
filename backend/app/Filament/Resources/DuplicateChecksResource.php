<?php

namespace App\Filament\Resources;

use App\Filament\Resources\DuplicateChecksResource\Pages;
use App\Models\DuplicateCheck;
use App\Models\RecipeDuplicatePair;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Textarea;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use UnitEnum;

/**
 * Admin review UI over the append-only duplicate_checks history (slice 6
 * ops — see docs/recipe-dedup.md). Decisions made here are recorded
 * append-only — a manual duplicate_checks row plus a resolved
 * recipe_duplicate_pairs row — and NEVER delete recipes.
 */
class DuplicateChecksResource extends Resource
{
    protected static ?string $model = DuplicateCheck::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentDuplicate;

    // The report/moderation queue group this resource belongs to (matches
    // the report resources' grouping).
    protected static string|UnitEnum|null $navigationGroup = 'Community';

    protected static ?int $navigationSort = 12;

    protected static bool $globallySearchable = false;

    public static function getModelLabel(): string
    {
        return 'Duplicate check';
    }

    public static function getPluralModelLabel(): string
    {
        return 'Duplicate checks';
    }

    public static function getNavigationBadge(): ?string
    {
        return (static::$model)::query()->where('status', DuplicateCheck::STATUS_NEEDS_REVIEW)->count()
            ?: null;
    }

    public static function canCreate(): bool
    {
        // Checks are engine-generated history; admins review, never create.
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        // Review hijacks happen through the record actions (append-only).
        return false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema
            ->schema([
                Section::make('Check')
                    ->schema([
                        Grid::make(3)
                            ->schema([
                                TextEntry::make('recipe.title')
                                    ->label('Candidate recipe')
                                    ->placeholder('— candidate was never persisted —')
                                    ->url(fn (?DuplicateCheck $record) => self::recipeUrl($record?->recipe_id))
                                    ->color('primary'),
                                TextEntry::make('matchedRecipe.title')
                                    ->label('Matched recipe')
                                    ->placeholder('—')
                                    ->url(fn (?DuplicateCheck $record) => self::recipeUrl($record?->matched_recipe_id))
                                    ->color('primary'),
                                TextEntry::make('status')
                                    ->badge()
                                    ->formatStateUsing(fn (string $state): string => str_replace('_', ' ', $state))
                                    ->color(fn (string $state): string => match ($state) {
                                        DuplicateCheck::STATUS_NEEDS_REVIEW => 'warning',
                                        default => 'success',
                                    }),
                                TextEntry::make('source'),
                                TextEntry::make('layer')
                                    ->badge()
                                    ->formatStateUsing(fn (int $state): string => match ($state) {
                                        1 => '1 — exact',
                                        2 => '2 — structural',
                                        3 => '3 — AI',
                                        default => (string) $state,
                                    })
                                    ->color('gray'),
                                TextEntry::make('action')
                                    ->badge()
                                    ->formatStateUsing(fn (string $state): string => str_replace('_', ' ', $state))
                                    ->color(fn (string $state): string => self::actionColor($state)),
                                TextEntry::make('classification')
                                    ->placeholder('—'),
                                TextEntry::make('ai_confidence')
                                    ->label('AI confidence')
                                    ->placeholder('—')
                                    ->formatStateUsing(fn (mixed $state): string => is_numeric($state)
                                        ? number_format((float) $state * 100, 1).'%'
                                        : (string) $state),
                                TextEntry::make('is_duplicate')
                                    ->label('Duplicate?')
                                    ->placeholder('— undecided —')
                                    ->formatStateUsing(fn (mixed $state): string => $state ? 'yes' : 'no'),
                                TextEntry::make('created_at')
                                    ->dateTime(),
                            ]),
                    ]),
                Section::make('Scores')
                    ->schema([
                        TextEntry::make('scores')
                            ->hiddenLabel()
                            ->columnSpanFull()
                            ->placeholder('No similarity scores recorded.')
                            ->formatStateUsing(fn (mixed $state): string => is_array($state)
                                ? (string) json_encode($state, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                                : (string) $state),
                    ]),
                Section::make('Reason & differences')
                    ->schema([
                        TextEntry::make('reason')
                            ->hiddenLabel()
                            ->columnSpanFull()
                            ->placeholder('No reason recorded.'),
                        TextEntry::make('differences')
                            ->hiddenLabel()
                            ->columnSpanFull()
                            ->listWithLineBreaks()
                            ->bulleted()
                            ->placeholder('No differences recorded.'),
                    ]),
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn ($query) => $query->with(['recipe', 'matchedRecipe']))
            ->columns([
                TextColumn::make('id')
                    ->sortable(),
                TextColumn::make('recipe.title')
                    ->label('Recipe')
                    ->limit(28)
                    ->placeholder('— never persisted —')
                    ->url(fn (?DuplicateCheck $record) => self::recipeUrl($record?->recipe_id))
                    ->color('primary'),
                TextColumn::make('matchedRecipe.title')
                    ->label('Matched recipe')
                    ->limit(28)
                    ->placeholder('—')
                    ->url(fn (?DuplicateCheck $record) => self::recipeUrl($record?->matched_recipe_id))
                    ->color('primary'),
                TextColumn::make('source')
                    ->badge()
                    ->sortable(),
                TextColumn::make('layer')
                    ->badge()
                    ->color('gray'),
                TextColumn::make('action')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => str_replace('_', ' ', $state))
                    ->color(fn (string $state): string => self::actionColor($state))
                    ->sortable(),
                TextColumn::make('classification')
                    ->placeholder('—')
                    ->limit(18),
                TextColumn::make('ai_confidence')
                    ->label('AI %')
                    ->placeholder('—')
                    ->formatStateUsing(fn (mixed $state): string => is_numeric($state)
                        ? number_format((float) $state * 100, 0).'%'
                        : (string) $state),
                TextColumn::make('status')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => str_replace('_', ' ', $state))
                    ->color(fn (string $state): string => match ($state) {
                        DuplicateCheck::STATUS_NEEDS_REVIEW => 'warning',
                        default => 'success',
                    })
                    ->sortable(),
                TextColumn::make('created_at')
                    ->dateTime()
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->options([
                        DuplicateCheck::STATUS_NEEDS_REVIEW => 'needs review',
                        DuplicateCheck::STATUS_RESOLVED => 'resolved',
                    ])
                    ->default(DuplicateCheck::STATUS_NEEDS_REVIEW),
                SelectFilter::make('source')
                    ->options([
                        DuplicateCheck::SOURCE_GENERATION => 'generation',
                        DuplicateCheck::SOURCE_BACKFILL => 'backfill',
                        DuplicateCheck::SOURCE_MANUAL => 'manual',
                        'auto_review' => 'auto review',
                    ]),
                SelectFilter::make('action')
                    ->options([
                        DuplicateCheck::ACTION_ACCEPTED => 'accepted',
                        DuplicateCheck::ACTION_REJECTED_DUPLICATE => 'rejected duplicate',
                        DuplicateCheck::ACTION_FLAGGED_REVIEW => 'flagged review',
                    ]),
            ])
            ->defaultSort('id', 'desc')
            ->deferLoading()
            ->defaultPaginationPageOption(25)
            ->recordActions([
                ViewAction::make(),
                self::markDuplicateAction(),
                self::markDistinctAction(),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListDuplicateChecks::route('/'),
            'view' => Pages\ViewDuplicateCheck::route('/{record}'),
        ];
    }

    /**
     * The record action backing "Mark duplicate": records an append-only
     * manual decision (pair + manual check row, original row resolved) —
     * identical semantics to `recipereal:dedup-review <id> duplicate`.
     */
    public static function markDuplicateAction(): Action
    {
        return self::reviewAction(
            key: 'markDuplicate',
            action: DuplicateCheck::ACTION_REJECTED_DUPLICATE,
            status: RecipeDuplicatePair::STATUS_CONFIRMED_DUPLICATE,
            label: 'Mark duplicate',
            icon: 'heroicon-o-document-duplicate',
            color: 'danger',
            confirmHeading: 'Mark this check as a DUPLICATE?',
            confirmDescription: 'Records a confirmed_duplicate pair + a new manual check row and resolves this check. Nothing is deleted.',
            successTitle: 'Recorded as duplicate',
        );
    }

    /** The record action backing "Mark distinct" (append-only manual decision). */
    public static function markDistinctAction(): Action
    {
        return self::reviewAction(
            key: 'markDistinct',
            action: DuplicateCheck::ACTION_ACCEPTED,
            status: RecipeDuplicatePair::STATUS_CONFIRMED_DISTINCT,
            label: 'Mark distinct',
            icon: 'heroicon-o-check-badge',
            color: 'success',
            confirmHeading: 'Mark this check as DISTINCT?',
            confirmDescription: 'Records a confirmed_distinct pair + a new manual check row and resolves this check. Nothing is deleted.',
            successTitle: 'Recorded as distinct',
        );
    }

    /**
     * The recordDecision core shared by the table row actions and the view
     * page: append-only history (pair + manual check row); the reviewed
     * check flips to resolved; NOTHING is deleted or overwritten.
     */
    public static function recordManualVerdict(
        DuplicateCheck $record,
        bool $isDuplicate,
        ?string $note = null,
        ?int $decidedBy = null,
    ): void {
        if ($record->status !== DuplicateCheck::STATUS_NEEDS_REVIEW) {
            return;
        }

        $pairable = $record->recipe_id !== null && $record->matched_recipe_id !== null;

        if ($pairable) {
            RecipeDuplicatePair::updateOrCreate(
                [
                    'recipe_id' => (int) $record->recipe_id,
                    'duplicate_of_recipe_id' => (int) $record->matched_recipe_id,
                ],
                [
                    'source' => 'manual',
                    'status' => $isDuplicate
                        ? RecipeDuplicatePair::STATUS_CONFIRMED_DUPLICATE
                        : RecipeDuplicatePair::STATUS_CONFIRMED_DISTINCT,
                    'check_id' => $record->id,
                    'decided_by' => $decidedBy,
                    'note' => $note !== null && trim($note) !== ''
                        ? trim($note)
                        : sprintf('manual review of check #%d', $record->id),
                    'decided_at' => now(),
                ],
            );
        }

        DuplicateCheck::query()->create([
            'recipe_id' => $record->recipe_id,
            'matched_recipe_id' => $record->matched_recipe_id,
            'batch_id' => $record->batch_id,
            'source' => DuplicateCheck::SOURCE_MANUAL,
            'layer' => 0,
            'action' => $isDuplicate
                ? DuplicateCheck::ACTION_REJECTED_DUPLICATE
                : DuplicateCheck::ACTION_ACCEPTED,
            'is_duplicate' => $isDuplicate,
            'scores' => $record->scores,
            'classification' => null,
            'ai_confidence' => null,
            'reason' => sprintf('manual review of check #%d: confirmed %s', $record->id, $isDuplicate ? 'duplicate' : 'distinct'),
            'differences' => $record->differences,
            'status' => DuplicateCheck::STATUS_RESOLVED,
        ]);

        $record->update(['status' => DuplicateCheck::STATUS_RESOLVED]);
    }

    private static function reviewAction(
        string $key,
        string $action,
        string $status,
        string $label,
        string $icon,
        string $color,
        string $confirmHeading,
        string $confirmDescription,
        string $successTitle,
    ): Action {
        $pairableTooltip = fn (?DuplicateCheck $record): ?string => $record !== null
            && ($record->recipe_id === null || $record->matched_recipe_id === null)
            ? 'Candidate was never persisted — no pair can be recorded.'
            : null;

        return Action::make($key)
            ->label($label)
            ->icon($icon)
            ->color($color)
            ->tooltip($pairableTooltip)
            ->disabled(fn (?DuplicateCheck $record): bool => $record === null
                || $record->status === DuplicateCheck::STATUS_RESOLVED
                || $record->recipe_id === null
                || $record->matched_recipe_id === null)
            ->requiresConfirmation()
            ->modalHeading($confirmHeading)
            ->modalDescription($confirmDescription)
            ->form([
                Textarea::make('note')
                    ->rows(2)
                    ->maxLength(500)
                    ->placeholder('Optional reviewer note stored on the pair.'),
            ])
            ->action(function (DuplicateCheck $record, array $data): void {
                self::recordManualVerdict(
                    $record,
                    isDuplicate: $action === DuplicateCheck::ACTION_REJECTED_DUPLICATE,
                    note: $data['note'] ?? null,
                    decidedBy: auth()->user()?->getAuthIdentifier(),
                );
            })
            ->successNotificationTitle($successTitle);
    }

    private static function actionColor(string $state): string
    {
        return match ($state) {
            DuplicateCheck::ACTION_ACCEPTED => 'success',
            DuplicateCheck::ACTION_REJECTED_DUPLICATE => 'danger',
            DuplicateCheck::ACTION_FLAGGED_REVIEW => 'warning',
            default => 'gray',
        };
    }

    /** Deep link a recipe title into the admin Recipes resource (or nothing to link). */
    private static function recipeUrl(?int $recipeId): ?string
    {
        return $recipeId === null ? null : RecipeResource::getUrl('view', ['record' => $recipeId]);
    }
}
