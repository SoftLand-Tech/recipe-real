<?php

namespace App\Filament\Widgets;

use App\Models\Post;
use Filament\Support\Colors\Color;
use Filament\Widgets\ChartWidget;

class PostsByKindChartWidget extends ChartWidget
{
    protected static ?int $sort = 4;

    protected ?string $heading = 'Posts by kind';

    protected string $color = 'primary';

    protected ?string $maxHeight = '250px';

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getData(): array
    {
        $palette = [
            'try' => Color::convertToHex(Color::Green[500]),
            'fail' => Color::convertToHex(Color::Rose[500]),
            'question' => Color::convertToHex(Color::Sky[500]),
        ];

        $data = [];
        $backgrounds = [];
        $labels = [];

        foreach (Post::KINDS as $kind) {
            $data[] = Post::query()->where('kind', $kind)->count();
            $backgrounds[] = $palette[$kind];
            $labels[] = ucfirst($kind);
        }

        return [
            'datasets' => [
                [
                    'label' => 'Posts by kind',
                    'data' => $data,
                    'backgroundColor' => $backgrounds,
                ],
            ],
            'labels' => $labels,
        ];
    }

    public function isEmpty(): bool
    {
        $data = $this->getCachedData();

        return empty(array_filter($data['datasets'][0]['data'] ?? []));
    }
}