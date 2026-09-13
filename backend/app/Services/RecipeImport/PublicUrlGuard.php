<?php

namespace App\Services\RecipeImport;

use InvalidArgumentException;

class PublicUrlGuard
{
    public function assertPublic(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw new InvalidArgumentException('The source URL must be an http(s) URL.');
        }

        if (
            $host === 'localhost'
            || str_ends_with($host, '.localhost')
            || $host === 'metadata.google.internal'
            || $host === '169.254.169.254'
        ) {
            throw new InvalidArgumentException('Private source URLs are not allowed.');
        }

        if (filter_var($host, FILTER_VALIDATE_IP) !== false && filter_var(
            $host,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) === false) {
            throw new InvalidArgumentException('Private source URLs are not allowed.');
        }
    }
}
