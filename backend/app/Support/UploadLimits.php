<?php

namespace App\Support;

class UploadLimits
{
    /**
     * Convert a php.ini size string (e.g. "2M", "128M", "1G", "-1") to bytes.
     * Returns -1 for unlimited.
     */
    public static function toBytes(string $value): int
    {
        $value = trim($value);
        if ($value === '' || $value === '-1') {
            return -1;
        }

        $unit = strtolower(substr($value, -1));
        if (is_numeric($unit)) {
            return (int) $value;
        }

        $number = (float) substr($value, 0, -1);

        return (int) match ($unit) {
            'g' => $number * 1024 * 1024 * 1024,
            'm' => $number * 1024 * 1024,
            'k' => $number * 1024,
            default => $number,
        };
    }

    /**
     * @return array{upload_max:int,post_max:int,memory:int,required:int,max_video_mb:int,max_image_mb:int}
     */
    public static function current(): array
    {
        $maxVideoMb = (int) config('recipereal.imports.max_video_mb', 100);
        $maxImageMb = (int) config('recipereal.imports.max_image_mb', 8);

        return [
            'upload_max' => self::toBytes((string) ini_get('upload_max_filesize')),
            'post_max' => self::toBytes((string) ini_get('post_max_size')),
            'memory' => self::toBytes((string) ini_get('memory_limit')),
            'required' => max($maxVideoMb, $maxImageMb) * 1024 * 1024,
            'max_video_mb' => $maxVideoMb,
            'max_image_mb' => $maxImageMb,
        ];
    }

    /**
     * @return list<string> Human-readable problems, empty when OK.
     */
    public static function issues(): array
    {
        $c = self::current();
        $issues = [];

        if ($c['upload_max'] !== -1 && $c['upload_max'] < $c['required']) {
            $issues[] = 'upload_max_filesize ('.ini_get('upload_max_filesize').') is below required '.$c['max_video_mb'].'M for videos.';
        }
        if ($c['post_max'] !== -1 && $c['post_max'] < $c['required']) {
            $issues[] = 'post_max_size ('.ini_get('post_max_size').') is below required '.$c['max_video_mb'].'M for videos.';
        }
        if ($c['memory'] !== -1 && $c['memory'] < $c['required']) {
            $issues[] = 'memory_limit ('.ini_get('memory_limit').') is below required '.$c['max_video_mb'].'M for videos.';
        }

        return $issues;
    }
}
