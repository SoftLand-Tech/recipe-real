<?php

namespace App\Filament\Widgets;

use Filament\Widgets\ChartWidget;

class PostsByKindChartWidget extends ChartWidget
{
    protected static ?int $sort = 4;

    protected ?string $heading = 'Posts';

    protected string $color = 'primary';

    protected ?string $maxHeight = '250px';

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getData(): array
    {
        return [
            'datasets' => [
                [
                    'label' => 'Posts',
                    'data' => [],
                    'backgroundColor' => [],
                ],
            ],
            'labels' => [],
        ];
    }

    public function isEmpty(): bool
    {
        return true;
    }
}