<?php

namespace App\Filament\Widgets;

use App\Models\CookSession;
use Filament\Support\Colors\Color;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class CookSessionsChartWidget extends ChartWidget
{
    protected static ?int $sort = 2;

    protected ?string $heading = 'Cooking activity';

    protected string $color = 'primary';

    protected ?string $maxHeight = '250px';

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getData(): array
    {
        $days = [];

        for ($i = 29; $i >= 0; $i--) {
            $days[now()->subDays($i)->format('Y-m-d')] = 0;
        }

        $counts = CookSession::query()
            ->where('created_at', '>=', now()->subDays(29)->startOfDay())
            ->selectRaw("strftime('%Y-%m-%d', created_at) AS date")
            ->selectRaw('COUNT(*) AS total')
            ->groupBy('date')
            ->pluck('total', 'date');

        foreach ($counts as $date => $total) {
            if (array_key_exists($date, $days)) {
                $days[$date] = (int) $total;
            }
        }

        return [
            'datasets' => [
                [
                    'label' => 'Cook sessions',
                    'data' => array_values($days),
                    'backgroundColor' => Color::convertToHex(Color::Amber[500]),
                ],
            ],
            'labels' => array_map(
                fn (string $date): string => Carbon::parse($date)->format('M j'),
                array_keys($days),
            ),
        ];
    }
}
