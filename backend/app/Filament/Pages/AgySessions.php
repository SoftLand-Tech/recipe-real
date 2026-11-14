<?php

namespace App\Filament\Pages;

use App\Models\RecipeImport;
use App\Support\AgyProcessInspector;
use BackedEnum;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use UnitEnum;

/**
 * Live view of running `agy` recipe-extraction sessions.
 *
 * Pinned first in the sidebar (navigationSort -100) with a badge counting
 * in-flight agy imports. The view re-renders every 10s (wire:poll), so it
 * tracks the queue worker in near-realtime: queued/processing agy imports
 * from the database plus the actual OS worker processes joined by import.
 */
class AgySessions extends Page
{
    protected static BackedEnum|string|null $navigationIcon = Heroicon::OutlinedCpuChip;

    protected static ?string $navigationLabel = 'Agy sessions';

    protected static ?int $navigationSort = -100;

    protected static UnitEnum|string|null $navigationGroup = null;

    protected string $view = 'filament.pages.agy-sessions';

    public static function getNavigationBadge(): ?string
    {
        $count = self::activeImportsQuery()->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return self::activeImportsQuery()->count() > 0 ? 'warning' : null;
    }

    protected function getViewData(): array
    {
        $imports = self::activeImportsQuery()
            ->latest('id')
            ->limit(50)
            ->get();

        $processes = app(AgyProcessInspector::class)->runningProcesses();
        $busyImportIds = array_values(array_filter(
            array_map(fn (array $row): ?int => $row['import_id'], $processes),
        ));

        return [
            'imports' => $imports,
            'processes' => $processes,
            'busyImportIds' => $busyImportIds,
            'checkedAt' => now()->toDateTimeString(),
        ];
    }

    private static function activeImportsQuery()
    {
        return RecipeImport::query()
            ->where('provider', 'agy')
            ->whereIn('status', ['queued', 'processing']);
    }
}
