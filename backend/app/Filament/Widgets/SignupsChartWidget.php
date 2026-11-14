<?php

namespace App\Filament\Widgets;

use App\Models\User;
use Filament\Support\Colors\Color;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class SignupsChartWidget extends ChartWidget
{
    protected static ?int $sort = 3;

    protected ?string $heading = 'New users';

    protected string $color = 'primary';

    protected ?string $maxHeight = '250px';

    protected function getType(): string
    {
        return 'line';
    }

    protected function getData(): array
    {
        $days = [];

        for ($i = 29; $i >= 0; $i--) {
            $days[now()->subDays($i)->format('Y-m-d')] = 0;
        }

        $counts = User::query()
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

        $hex = Color::convertToHex(Color::Sky[500]);
        [$red, $green, $blue] = sscanf(Color::convertToRgb(Color::Sky[500]), 'rgb(%d, %d, %d)');

        return [
            'datasets' => [
                [
                    'label' => 'New users',
                    'data' => array_values($days),
                    'borderColor' => $hex,
                    'backgroundColor' => "rgba({$red}, {$green}, {$blue}, 0.15)",
                    'fill' => true,
                    'tension' => 0.4,
                ],
            ],
            'labels' => array_map(
                fn (string $date): string => Carbon::parse($date)->format('M j'),
                array_keys($days),
            ),
        ];
    }
}
