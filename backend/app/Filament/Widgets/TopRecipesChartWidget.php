<?php

namespace App\Filament\Widgets;

use App\Models\CookSession;
use Filament\Support\Colors\Color;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Str;

class TopRecipesChartWidget extends ChartWidget
{
    protected static ?int $sort = 5;

    protected ?string $heading = 'Most cooked recipes';

    protected string $color = 'primary';

    protected ?string $maxHeight = '320px';

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getOptions(): array
    {
        return [
            'indexAxis' => 'y',
        ];
    }

    protected function getData(): array
    {
        $rows = CookSession::query()
            ->select('recipe_id')
            ->selectRaw('COUNT(*) AS total')
            ->whereNotNull('recipe_id')
            ->groupBy('recipe_id')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        $labels = [];
        $data = [];

        foreach ($rows as $row) {
            $labels[] = Str::limit($row->recipe?->title ?? 'Deleted recipe', 30);
            $data[] = (int) $row->total;
        }

        return [
            'datasets' => [
                [
                    'label' => 'Cook sessions',
                    'data' => $data,
                    'backgroundColor' => Color::convertToHex(Color::Teal[500]),
                ],
            ],
            'labels' => $labels,
        ];
    }

    public function isEmpty(): bool
    {
        $data = $this->getCachedData();

        return empty($data['datasets'][0]['data'] ?? []);
    }
}