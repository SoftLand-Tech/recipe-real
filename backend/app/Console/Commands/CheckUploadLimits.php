<?php

namespace App\Console\Commands;

use App\Support\UploadLimits;
use Illuminate\Console\Command;

class CheckUploadLimits extends Command
{
    protected $signature = 'recipereal:check-upload-limits';

    protected $description = 'Fail when PHP upload limits are below the recipe-import max (video/image MB).';

    public function handle(): int
    {
        $current = UploadLimits::current();
        $issues = UploadLimits::issues();

        $fmt = fn (int $bytes): string => $bytes === -1 ? 'unlimited' : round($bytes / 1024 / 1024, 1).'M';

        $this->table(
            ['Setting', 'Current', 'Required'],
            [
                ['upload_max_filesize', (string) ini_get('upload_max_filesize').' ('.$fmt($current['upload_max']).')', $current['max_video_mb'].'M'],
                ['post_max_size', (string) ini_get('post_max_size').' ('.$fmt($current['post_max']).')', $current['max_video_mb'].'M'],
                ['memory_limit', (string) ini_get('memory_limit').' ('.$fmt($current['memory']).')', $current['max_video_mb'].'M+'],
                ['app max_video_mb', $current['max_video_mb'].'M', '-'],
                ['app max_image_mb', $current['max_image_mb'].'M', '-'],
            ],
        );

        if ($issues === []) {
            $this->info('Upload limits OK.');

            return self::SUCCESS;
        }

        foreach ($issues as $issue) {
            $this->error($issue);
        }
        $this->line('Fix: set upload_max_filesize=128M, post_max_size=128M, memory_limit=256M in php.ini (and client_max_body_size 128M on nginx), then restart php-fpm/serve.');

        return self::FAILURE;
    }
}
