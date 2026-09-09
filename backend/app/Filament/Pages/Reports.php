<?php

namespace App\Filament\Pages;

use App\Models\CommentReport;
use App\Models\PostReport;
use BackedEnum;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use UnitEnum;

/**
 * Combined moderation queue: post reports and comment reports as two tabs
 * on one page. Each tab is a full queue table (View / Dismiss /
 * Remove+notify / Ban author) shared with its resource, so the actions are
 * identical wherever the queue is viewed.
 */
class Reports extends Page
{
    protected static BackedEnum|string|null $navigationIcon = Heroicon::OutlinedFlag;

    protected static UnitEnum|string|null $navigationGroup = 'Community';

    protected static ?string $navigationLabel = 'Reports';

    protected static ?int $navigationSort = 3;

    protected string $view = 'filament.pages.reports';

    public static function getNavigationBadge(): ?string
    {
        $count = PostReport::query()->count() + CommentReport::query()->count();

        return $count > 0 ? (string) $count : null;
    }

    protected function getViewData(): array
    {
        return [
            'postReportsCount' => PostReport::query()->count(),
            'commentReportsCount' => CommentReport::query()->count(),
        ];
    }
}
