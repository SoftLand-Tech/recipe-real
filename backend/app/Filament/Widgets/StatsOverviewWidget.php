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
use Illuminate\Database\Eloquent\Builder;

class StatsOverviewWidget extends BaseStatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected ?string $pollingInterval = '30s';

    protected int | string | array $columnSpan = 'full';

    protected int | array | null $columns = 3;

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $weekStart = now()->startOfWeek();
        $previousWeekStart = (clone $weekStart)->subWeek();

        $usersTrend = $this->weekDelta(User::query(), $weekStart, $previousWeekStart);
        $postsTrend = $this->weekDelta(Post::query(), $weekStart, $previousWeekStart);
        $sessionsTrend = $this->weekDelta(CookSession::query(), $weekStart, $previousWeekStart);
        $recipesTrend = $this->weekDelta(Recipe::query(), $weekStart, $previousWeekStart);

        return [
            Stat::make('Users', User::count())
                ->description($this->trendDescription('this week', $usersTrend))
                ->descriptionIcon($this->trendIcon($usersTrend))
                ->descriptionColor($this->trendColor($usersTrend))
                ->color($this->trendColor($usersTrend))
                ->chart($this->dailyCounts(User::query())),
            Stat::make('Recipes', Recipe::count())
                ->description('Community: '.Recipe::where('source_type', 'user')->count().' · Imported: '.Recipe::where('source_type', 'foodcom')->count())
                ->descriptionIcon($this->trendIcon($recipesTrend))
                ->descriptionColor('info')
                ->color('info')
                ->chart($this->dailyCounts(Recipe::query())),
            Stat::make('Posts', Post::count())
                ->description($this->trendDescription('this week', $postsTrend))
                ->descriptionIcon($this->trendIcon($postsTrend))
                ->descriptionColor($this->trendColor($postsTrend))
                ->color($this->trendColor($postsTrend))
                ->chart($this->dailyCounts(Post::query())),
            Stat::make('Cook sessions (this week)', $this->weekCount(CookSession::query(), $weekStart))
                ->description($this->trendDescription('vs last week', $sessionsTrend))
                ->descriptionIcon($this->trendIcon($sessionsTrend))
                ->descriptionColor($this->trendColor($sessionsTrend))
                ->color($this->trendColor($sessionsTrend))
                ->chart($this->dailyCounts(CookSession::query())),
            Stat::make('Public notes', RecipeNote::where('is_public', true)->count())
                ->description('Shared recipe notes')
                ->descriptionIcon(Heroicon::OutlinedChatBubbleLeftRight)
                ->color('gray'),
        ];
    }

    private function weekCount(Builder $query, \DateTimeInterface $weekStart): int
    {
        return $query->where('created_at', '>=', $weekStart)->count();
    }

    /**
     * How many more (or fewer) rows were created this week versus the
     * previous one, using Monday-start weeks like the original widget.
     */
    private function weekDelta(Builder $query, \DateTimeInterface $weekStart, \DateTimeInterface $previousWeekStart): int
    {
        $current = $this->weekCount(clone $query, $weekStart);
        $previous = (clone $query)->whereBetween('created_at', [$previousWeekStart, $weekStart])->count();

        return $current - $previous;
    }

    private function trendDescription(string $period, int $delta): string
    {
        return match (true) {
            $delta > 0 => "+{$delta} {$period}",
            $delta < 0 => "{$delta} {$period}",
            default => "Steady {$period}",
        };
    }

    private function trendIcon(int $delta): Heroicon
    {
        return match (true) {
            $delta > 0 => Heroicon::OutlinedArrowTrendingUp,
            $delta < 0 => Heroicon::OutlinedArrowTrendingDown,
            default => Heroicon::OutlinedMinus,
        };
    }

    private function trendColor(int $delta): string
    {
        return match (true) {
            $delta > 0 => 'success',
            $delta < 0 => 'danger',
            default => 'gray',
        };
    }

    /**
     * Last 14 days of daily counts for the stat's mini-sparkline. The query
     * is a single grouped aggregate bounded by the created_at index, so it
     * is cheap to run for the user/cook-session/post/recipe tables.
     *
     * @return array<int, float>
     */
    private function dailyCounts(Builder $query): array
    {
        $start = now()->subDays(13)->startOfDay();
        $series = array_fill(0, 14, 0);

        $counts = (clone $query)
            ->where('created_at', '>=', $start)
            ->selectRaw("strftime('%Y-%m-%d', created_at) AS date")
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('date')
            ->pluck('total', 'date');

        foreach ($counts as $date => $total) {
            $index = (int) now()->parse($date)->startOfDay()->diffInDays($start);

            if (isset($series[$index])) {
                $series[$index] = (int) $total;
            }
        }

        return $series;
    }
}