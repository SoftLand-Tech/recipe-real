<?php

namespace App\Filament\Widgets;

use App\Models\CookSession;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use Filament\Support\Colors\Color;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget as BaseStatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Database\Eloquent\Builder;

class StatsOverviewWidget extends BaseStatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected ?string $pollingInterval = '30s';

    protected int | string | array $columnSpan = 'full';

    protected int | array | null $columns = 4;

    /**
     * @return array<Stat>
     */
    protected function getStats(): array
    {
        $weekStart = now()->startOfWeek();
        $previousWeekStart = (clone $weekStart)->subWeek();

        $usersTrend = $this->weekDelta(User::query(), $weekStart, $previousWeekStart);
        $postsTrend = $this->weekDelta(Post::query(), $weekStart, $previousWeekStart);

        $weekSessions = $this->weekCount(CookSession::query(), $weekStart);
        $weekQuickSessions = $this->weekCount(
            CookSession::query()->where('source', 'quick'),
            $weekStart,
        );

        $publicNotes = RecipeNote::where('is_public', true);
        $publicNotesCount = (clone $publicNotes)->count();
        $notedRecipes = (clone $publicNotes)->distinct('recipe_id')->count('recipe_id');

        [$honestyGap, $gapSamples] = $this->honestyGap();
        [$quickShare, $quickSessions, $sessionCount] = $this->quickTimeShare();

        return [
            Stat::make('Users', number_format(User::count()))
                ->icon(Heroicon::OutlinedUsers)
                ->description($this->trendDescription('this week', $usersTrend).' · '.number_format(User::whereNotNull('google_sub')->count()).' on Google')
                ->descriptionIcon($this->trendIcon($usersTrend))
                ->color(Color::Amber)
                ->chart($this->dailyCounts(User::query())),
            Stat::make('Recipes', number_format(Recipe::count()))
                ->icon(Heroicon::OutlinedBookOpen)
                ->description('Community: '.number_format(Recipe::where('source_type', 'user')->count()).' · Imported: '.number_format(Recipe::where('source_type', 'foodcom')->count()))
                ->color(Color::Sky)
                ->chart($this->dailyCounts(Recipe::query())),
            Stat::make('Posts', number_format(Post::count()))
                ->icon(Heroicon::OutlinedNewspaper)
                ->description($this->trendDescription('this week', $postsTrend).' · '.number_format(PostComment::count()).' comments')
                ->descriptionIcon($this->trendIcon($postsTrend))
                ->color(Color::Green)
                ->chart($this->dailyCounts(Post::query())),
            Stat::make('Cook sessions (this week)', number_format($weekSessions))
                ->icon(Heroicon::OutlinedFire)
                ->description(($weekSessions - $weekQuickSessions).' cooks · '.$weekQuickSessions.' quick times')
                ->color(Color::Orange)
                ->chart($this->dailyCounts(CookSession::query())),
            Stat::make('Public notes', number_format($publicNotesCount))
                ->icon(Heroicon::OutlinedChatBubbleLeftRight)
                ->description(number_format($publicNotesCount).' notes · '.number_format($notedRecipes).' recipes')
                ->color(Color::Rose)
                ->chart($this->dailyCounts(RecipeNote::where('is_public', true))),
            Stat::make('Honesty gap', $honestyGap === null ? '—' : ($honestyGap > 0 ? '+' : '').number_format($honestyGap, 1).'%')
                ->icon(Heroicon::OutlinedScale)
                ->description($honestyGap === null ? 'No reality data yet' : 'vs recipe claims · '.number_format($gapSamples).' recipes')
                ->color(match (true) {
                    $honestyGap === null, $honestyGap == 0 => Color::Gray,
                    $honestyGap > 0 => Color::Rose,
                    default => Color::Green,
                })
                ->chart($honestyGap === null ? null : $this->dailyHonestyGap()),
            Stat::make('Active cooks', number_format($this->activeCooks()))
                ->icon(Heroicon::OutlinedUserGroup)
                ->description('distinct cooks · last 7 days')
                ->color(Color::Violet)
                ->chart($this->dailyActiveCooks()),
            Stat::make('Quick-time share', $quickShare === null ? '—' : number_format($quickShare, 1).'%')
                ->icon(Heroicon::OutlinedBolt)
                ->description($quickShare === null ? 'No sessions in last 30 days' : $quickSessions.' of '.$sessionCount.' sessions · last 30 days')
                ->color(Color::Teal)
                ->chart($quickShare === null ? null : $this->dailyQuickShare()),
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

    /**
     * Distinct users who logged a cook session in the last 7 days. A single
     * bounded count over the user_id index, cheap on any row count.
     */
    private function activeCooks(): int
    {
        return CookSession::query()
            ->where('created_at', '>=', now()->subDays(7))
            ->distinct('user_id')
            ->count('user_id');
    }

    /**
     * The average honesty gap across all-time recipes that carry both a
     * claimed publisher time and a measured reality time: how much longer
     * reality takes than the recipe claims, expressed per recipe as a
     * percentage of the claim. Positive means recipes under-claim.
     *
     * @return array{float|null, int} [average gap %, recipes sampled]
     */
    private function honestyGap(): array
    {
        $row = Recipe::query()
            ->whereNotNull('reality_minutes')
            ->whereNotNull('publisher_time_minutes')
            ->where('publisher_time_minutes', '>', 0)
            ->selectRaw('AVG((reality_minutes - publisher_time_minutes) / publisher_time_minutes * 100.0) AS gap')
            ->selectRaw('COUNT(*) AS samples')
            ->first();

        return [
            $row?->gap === null ? null : round((float) $row->gap, 1),
            (int) ($row?->samples ?? 0),
        ];
    }

    /**
     * Share of quick-source sessions among all cook sessions in the last
     * 30 days, plus the raw quick/total counts for the description. One
     * grouped count bounded by the created_at index.
     *
     * @return array{float|null, int, int} [share %, quick sessions, total sessions]
     */
    private function quickTimeShare(): array
    {
        $counts = CookSession::query()
            ->where('created_at', '>=', now()->subDays(30))
            ->select('source')
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('source')
            ->pluck('total', 'source');

        $total = $counts->sum();
        $quick = (int) $counts->get('quick', 0);

        return [
            $total > 0 ? round($quick / $total * 100, 1) : null,
            $quick,
            $total,
        ];
    }

    /**
     * Last 14 days of daily counts for the stat's mini-sparkline. The query
     * is a single grouped aggregate bounded by the created_at index, so it
     * is cheap to run for the user/cook-session/post/recipe/note tables.
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

    /**
     * Last 14 days of distinct cooks per day for the sparkline. Same shape
     * as dailyCounts() but counts DISTINCT user_id, still one bounded
     * grouped aggregate.
     *
     * @return array<int, float>
     */
    private function dailyActiveCooks(): array
    {
        $start = now()->subDays(13)->startOfDay();
        $series = array_fill(0, 14, 0);

        $counts = CookSession::query()
            ->where('created_at', '>=', $start)
            ->selectRaw("strftime('%Y-%m-%d', created_at) AS date")
            ->selectRaw('COUNT(DISTINCT user_id) AS total')
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

    /**
     * Last 14 days of the quick-time share (%) per day for the sparkline.
     * A single bounded grouped aggregate over (date, source), with the
     * share folded per day in PHP.
     *
     * @return array<int, float>
     */
    private function dailyQuickShare(): array
    {
        $start = now()->subDays(13)->startOfDay();
        $totals = array_fill(0, 14, 0);
        $quicks = array_fill(0, 14, 0);

        $rows = CookSession::query()
            ->where('created_at', '>=', $start)
            ->selectRaw("strftime('%Y-%m-%d', created_at) AS date")
            ->select('source')
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('date', 'source')
            ->get();

        foreach ($rows as $row) {
            $index = (int) now()->parse($row->date)->startOfDay()->diffInDays($start);

            if (! isset($totals[$index])) {
                continue;
            }

            $totals[$index] += (int) $row->total;

            if ($row->source === 'quick') {
                $quicks[$index] += (int) $row->total;
            }
        }

        return array_map(
            fn (int $total, int $quick): float => $total > 0 ? round($quick / $total * 100, 1) : 0.0,
            $totals,
            $quicks,
        );
    }

    /**
     * Last 14 days of the average honesty gap (%) per created-day for the
     * sparkline, over recipes created in the window that carry both a
     * claimed publisher time and a reality time. Same bounded grouped
     * aggregate shape as the other sparkline queries.
     *
     * @return array<int, float>
     */
    private function dailyHonestyGap(): array
    {
        $start = now()->subDays(13)->startOfDay();
        $series = array_fill(0, 14, 0.0);

        $gaps = Recipe::query()
            ->where('created_at', '>=', $start)
            ->whereNotNull('reality_minutes')
            ->whereNotNull('publisher_time_minutes')
            ->where('publisher_time_minutes', '>', 0)
            ->selectRaw("strftime('%Y-%m-%d', created_at) AS date")
            ->selectRaw('AVG((reality_minutes - publisher_time_minutes) / publisher_time_minutes * 100.0) AS gap')
            ->groupBy('date')
            ->pluck('gap', 'date');

        foreach ($gaps as $date => $gap) {
            $index = (int) now()->parse($date)->startOfDay()->diffInDays($start);

            if (isset($series[$index])) {
                $series[$index] = (float) $gap;
            }
        }

        return $series;
    }
}
