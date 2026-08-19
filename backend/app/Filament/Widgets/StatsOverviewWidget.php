<?php

namespace App\Filament\Widgets;

use App\Models\CookSession;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget as BaseStatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class StatsOverviewWidget extends BaseStatsOverviewWidget
{
    protected ?string $pollingInterval = '30s';

    protected int | string | array $columnSpan = 'full';

    protected int | array | null $columns = 3;

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $weekStart = now()->startOfWeek();

        $newUsers = User::where('created_at', '>=', $weekStart)->count();
        $cookSessionsThisWeek = CookSession::where('created_at', '>=', $weekStart)->count();
        $quickTimesThisWeek = CookSession::where('source', 'quick')
            ->where('created_at', '>=', $weekStart)
            ->count();

        return [
            Stat::make('Users', User::count())
                ->description("{$newUsers} new this week")
                ->descriptionIcon(Heroicon::OutlinedUsers)
                ->color('primary'),
            Stat::make('Recipes', Recipe::count())
                ->description('Community: '.Recipe::where('source_type', 'user')->count().' · Imported: '.Recipe::where('source_type', 'foodcom')->count())
                ->descriptionIcon(Heroicon::OutlinedRectangleStack)
                ->color('info'),
            Stat::make('Posts', Post::count())
                ->description(PostComment::count().' comments')
                ->descriptionIcon(Heroicon::OutlinedNewspaper)
                ->color('success'),
            Stat::make('Cook sessions (this week)', $cookSessionsThisWeek)
                ->description("{$quickTimesThisWeek} quick times")
                ->descriptionIcon(Heroicon::OutlinedFire)
                ->color('warning'),
            Stat::make('Public notes', RecipeNote::where('is_public', true)->count())
                ->descriptionIcon(Heroicon::OutlinedChatBubbleLeftRight)
                ->color('gray'),
        ];
    }
}