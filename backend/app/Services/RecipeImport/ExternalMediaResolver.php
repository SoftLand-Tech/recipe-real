<?php

namespace App\Services\RecipeImport;

use App\Models\RecipeImport;
use App\Services\RecipeImport\Contracts\RecipeMediaResolver;
use Illuminate\Support\Facades\Http;
use Throwable;

class ExternalMediaResolver implements RecipeMediaResolver
{
    public function __construct(
        private readonly RecipeImportStorage $storage,
        private readonly PublicUrlGuard $urlGuard,
    ) {}

    public function resolve(RecipeImport $import): array
    {
        $assets = is_array($import->source_assets) ? $import->source_assets : [];
        $source = [
            'source_url' => $import->source_url,
            'platform' => $import->source_platform,
            'assets' => $this->storage->aiAssets($assets),
            'media' => [],
            'metadata' => [],
            'transcript' => null,
            'warnings' => [],
        ];

        if ($import->source_url === null || trim($import->source_url) === '') {
            return $source;
        }

        try {
            $this->urlGuard->assertPublic($import->source_url);
        } catch (Throwable $e) {
            throw new RecipeImportException($e->getMessage(), 'invalid_source_url');
        }

        $resolverUrl = trim((string) config('recipereal.media_resolver.url', ''));
        if ($resolverUrl !== '') {
            try {
                $request = Http::timeout((int) config('recipereal.media_resolver.timeout', 45))
                    ->connectTimeout(10)
                    ->acceptJson();
                $token = trim((string) config('recipereal.media_resolver.token', ''));
                if ($token !== '') {
                    $request = $request->withToken($token);
                }

                $response = $request->post($resolverUrl, [
                    'url' => $import->source_url,
                    'platform' => $import->source_platform,
                ]);

                if ($response->successful()) {
                    $source = $this->mergeResolverPayload($source, $response->json() ?: []);
                } else {
                    $source['warnings'][] = 'media_resolver_unavailable';
                }
            } catch (Throwable) {
                $source['warnings'][] = 'media_resolver_unavailable';
            }
        } else {
            $source['warnings'][] = 'media_resolver_not_configured';
        }

        // Public oEmbed metadata is useful even when a downloader is not
        // configured. It provides title/author/thumbnail context to the AI,
        // while the source attribution remains the original URL.
        $oembed = $this->oembed($import->source_url, $import->source_platform);
        if ($oembed !== []) {
            $source['metadata'] = array_merge($source['metadata'], $oembed);
            if (empty($source['thumbnail_url']) && ! empty($oembed['thumbnail_url'])) {
                $source['thumbnail_url'] = $oembed['thumbnail_url'];
            }
        }

        return $source;
    }

    /** @param array<string, mixed> $source @param array<string, mixed> $payload */
    private function mergeResolverPayload(array $source, array $payload): array
    {
        $payload = is_array($payload['data'] ?? null) ? $payload['data'] : $payload;
        $source['metadata'] = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];
        $source['thumbnail_url'] = $payload['thumbnail_url'] ?? null;
        $source['transcript'] = is_string($payload['transcript'] ?? null)
            ? trim($payload['transcript'])
            : null;

        $media = $payload['media'] ?? null;
        if (! is_array($media)) {
            $media = [];
        }
        if (! empty($payload['media_url'])) {
            $media[] = ['url' => $payload['media_url'], 'kind' => 'video'];
        }
        if (is_array($payload['media_urls'] ?? null)) {
            foreach ($payload['media_urls'] as $url) {
                if (is_string($url)) {
                    $media[] = ['url' => $url, 'kind' => 'video'];
                }
            }
        }

        $source['media'] = array_values(array_filter(array_map(
            fn (mixed $item): ?array => is_string($item)
                ? ['url' => $item, 'kind' => 'video']
                : (is_array($item) && ! empty($item['url']) ? [
                    'url' => $item['url'],
                    'kind' => $item['kind'] ?? 'video',
                    'mime_type' => $item['mime_type'] ?? null,
                ] : null),
            $media,
        )));
        $source['metadata'] = array_merge($source['metadata'], array_filter([
            'author_name' => $payload['author_name'] ?? null,
            'author_url' => $payload['author_url'] ?? null,
            'title' => $payload['title'] ?? null,
        ]));

        return $source;
    }

    /** @return array<string, mixed> */
    private function oembed(string $url, ?string $platform): array
    {
        $endpoint = match ($platform) {
            'tiktok' => 'https://www.tiktok.com/oembed?url='.urlencode($url),
            'x' => 'https://publish.twitter.com/oembed?url='.urlencode($url),
            default => null,
        };

        if ($endpoint === null) {
            return [];
        }

        try {
            $response = Http::timeout(15)->connectTimeout(6)->acceptJson()->get($endpoint);

            return $response->successful() && is_array($response->json())
                ? $response->json()
                : [];
        } catch (Throwable) {
            return [];
        }
    }
}
