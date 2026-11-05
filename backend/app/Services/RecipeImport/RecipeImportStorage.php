<?php

namespace App\Services\RecipeImport;

use App\Models\RecipeImport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class RecipeImportStorage
{
    public function diskName(): string
    {
        return (string) config('recipereal.imports.disk', 'local');
    }

    /**
     * @return array{role: string, kind: string, disk: string, path: string, mime_type: string, original_name: string, size: int}
     */
    public function storeUpload(RecipeImport $import, UploadedFile $file, string $role): array
    {
        $mime = (string) ($file->getMimeType() ?: 'application/octet-stream');
        $kind = str_starts_with($mime, 'video/') ? 'video' : 'image';
        $extension = strtolower($file->extension() ?: ($kind === 'video' ? 'mp4' : 'jpg'));
        $filename = Str::ulid()->toBase32().'.'.$extension;
        $path = 'recipe-imports/'.$import->id.'/'.$filename;
        $disk = Storage::disk($this->diskName());
        $disk->putFileAs(dirname($path), $file, basename($path));

        return [
            'role' => $role,
            'kind' => $kind,
            'disk' => $this->diskName(),
            'path' => $path,
            'mime_type' => $mime,
            'original_name' => (string) $file->getClientOriginalName(),
            'size' => (int) ($file->getSize() ?: 0),
        ];
    }

    /**
     * Build the source payload sent to the configured AI adapter. Small local
     * files are inlined; large files remain private and are represented by
     * metadata so a resolver/provider can handle them without leaking paths.
     *
     * @param  list<array<string, mixed>>  $assets
     * @return list<array<string, mixed>>
     */
    public function aiAssets(array $assets): array
    {
        $maxInline = (int) config('recipereal.ai.inline_max_bytes', 20 * 1024 * 1024);
        $result = [];

        foreach ($assets as $asset) {
            $item = [
                'role' => $asset['role'] ?? 'attachment',
                'kind' => $asset['kind'] ?? 'image',
                'mime_type' => $asset['mime_type'] ?? null,
                'original_name' => $asset['original_name'] ?? null,
                'url' => $asset['url'] ?? null,
            ];

            $path = $asset['path'] ?? null;
            $diskName = $asset['disk'] ?? $this->diskName();
            $size = (int) ($asset['size'] ?? 0);

            if ($path !== null && $size > 0 && $size <= $maxInline) {
                try {
                    $contents = Storage::disk($diskName)->get($path);
                    $item['data_base64'] = base64_encode($contents);
                } catch (Throwable) {
                    $item['read_error'] = true;
                }
            } elseif ($path !== null) {
                $item['private_storage_path'] = $path;
            }

            $result[] = $item;
        }

        return $result;
    }

    /**
     * Copy private import assets into an isolated CLI workspace without
     * exposing the application's storage path to the agent.
     *
     * @return list<array{role: string, kind: string, mime_type: string|null, original_name: string|null, relative_path: string}>
     */
    public function stageCliAssets(RecipeImport $import, string $directory): array
    {
        File::ensureDirectoryExists($directory);
        $staged = [];
        $assets = is_array($import->source_assets) ? $import->source_assets : [];

        foreach (array_values($assets) as $index => $asset) {
            if (! is_array($asset) || empty($asset['path'])) {
                continue;
            }

            $mime = (string) ($asset['mime_type'] ?? 'application/octet-stream');
            $filename = 'asset-'.($index + 1).'.'.$this->safeExtension($mime, (string) $asset['path']);
            $target = rtrim($directory, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$filename;
            $stream = null;
            $output = null;

            try {
                $stream = Storage::disk($asset['disk'] ?? $this->diskName())->readStream($asset['path']);
                if (! is_resource($stream)) {
                    throw new RuntimeException('The source asset could not be read.');
                }

                $output = fopen($target, 'wb');
                if ($output === false || stream_copy_to_stream($stream, $output) === false) {
                    throw new RuntimeException('The source asset could not be staged.');
                }
            } catch (Throwable $e) {
                if (is_file($target)) {
                    File::delete($target);
                }

                throw new RecipeImportException(
                    'The source asset could not be prepared for the agy worker.',
                    'source_asset_unreadable',
                    false,
                    $e,
                );
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
                if (is_resource($output)) {
                    fclose($output);
                }
            }

            $staged[] = [
                'role' => (string) ($asset['role'] ?? 'attachment'),
                'kind' => (string) ($asset['kind'] ?? 'image'),
                'mime_type' => $mime !== '' ? $mime : null,
                'original_name' => isset($asset['original_name']) ? (string) $asset['original_name'] : null,
                'relative_path' => 'media/'.$filename,
            ];
        }

        return $staged;
    }

    /**
     * Copy the first available image to the public recipe-media disk and
     * return the stable URL used as the recipe cover.
     */
    public function promoteFirstImage(RecipeImport $import, array $assets): ?string
    {
        $image = collect($assets)->first(fn (array $asset): bool => ($asset['kind'] ?? null) === 'image');

        if (! is_array($image) || empty($image['path'])) {
            return null;
        }

        try {
            $contents = Storage::disk($image['disk'] ?? $this->diskName())->get($image['path']);
            $extension = strtolower(pathinfo((string) $image['path'], PATHINFO_EXTENSION) ?: 'jpg');
            $filename = Str::ulid()->toBase32().'.'.$extension;

            if (config('filesystems.disks.s3.bucket') !== null) {
                $path = 'recipereal/recipes/'.$filename;
                Storage::disk('s3')->put($path, $contents, 'public');

                return Storage::disk('s3')->url($path);
            }

            $path = 'recipes/'.$filename;
            Storage::disk('public')->put($path, $contents);

            return rtrim((string) config('app.url'), '/').'/storage/'.$path;
        } catch (Throwable) {
            return null;
        }
    }

    /**
     * Download and promote a resolver thumbnail when it is a public image.
     */
    public function promoteRemoteImage(?string $url): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        try {
            $guard = app(PublicUrlGuard::class);
            $maxBytes = (int) config('recipereal.imports.max_image_mb', 8) * 1024 * 1024;

            // Manual redirect walk (≤3 hops). Auto-follow would re-request
            // the redirected host WITHOUT re-running the SSRF guard, so a
            // public first hop could bounce the fetch at an internal
            // address; each Location gets a fresh assertPublic() below.
            $response = null;
            $current = $url;

            for ($hop = 0; $hop <= 3; $hop++) {
                $guard->assertPublic($current);
                $response = Http::timeout(20)->connectTimeout(8)->withoutRedirecting()->get($current);

                if (! $response->isRedirect()) {
                    break;
                }

                $location = trim((string) $response->header('Location'));

                if ($location === '' || $hop === 3) {
                    return null; // redirect loop / too many hops / no target
                }

                $current = $this->absoluteRedirectUrl($current, $location);

                if ($current === null) {
                    return null;
                }
            }

            if ($response === null) {
                return null;
            }

            $mime = strtolower((string) $response->header('Content-Type'));
            $contentLength = (int) $response->header('Content-Length', 0);

            if (
                ! $response->successful()
                || ! str_starts_with($mime, 'image/')
                || ($contentLength > 0 && $contentLength > $maxBytes)
            ) {
                return null;
            }

            $body = $response->body();
            if (strlen($body) > $maxBytes) {
                return null;
            }

            $extension = match (true) {
                str_contains($mime, 'png') => 'png',
                str_contains($mime, 'webp') => 'webp',
                default => 'jpg',
            };
            $filename = Str::ulid()->toBase32().'.'.$extension;

            if (config('filesystems.disks.s3.bucket') !== null) {
                $path = 'recipereal/recipes/'.$filename;
                Storage::disk('s3')->put($path, $body, 'public');

                return Storage::disk('s3')->url($path);
            }

            $path = 'recipes/'.$filename;
            Storage::disk('public')->put($path, $body);

            return rtrim((string) config('app.url'), '/').'/storage/'.$path;
        } catch (Throwable) {
            return null;
        }
    }

    /** @param list<array<string, mixed>> $assets */
    public function deleteAssets(array $assets): void
    {
        foreach ($assets as $asset) {
            if (! empty($asset['path'])) {
                Storage::disk($asset['disk'] ?? $this->diskName())->delete($asset['path']);
            }
        }
    }

    /**
     * Resolve a redirect Location against the URL that produced it, so the
     * SSRF guard vets the FINAL absolute URL on every hop (absolute,
     * scheme-relative "//host/x" and path-relative targets all resolve;
     * anything that cannot resolve cleanly aborts the fetch).
     */
    private function absoluteRedirectUrl(string $base, string $location): ?string
    {
        $locationParts = parse_url($location);

        if (! empty($locationParts['scheme']) && ! empty($locationParts['host'])) {
            return $location;
        }

        $baseParts = parse_url($base);

        if (empty($baseParts['scheme']) || empty($baseParts['host'])) {
            return null;
        }

        $prefix = strtolower((string) $baseParts['scheme']).'://'.strtolower((string) $baseParts['host'])
            .(isset($baseParts['port']) ? ':'.$baseParts['port'] : '');

        // Scheme-relative ("//cdn.example.com/img.png").
        if (str_starts_with($location, '//')) {
            return strtolower((string) $baseParts['scheme']).':'.$location;
        }

        // Absolute path ("/img.png").
        if (str_starts_with($location, '/')) {
            return $prefix.$location;
        }

        // Path-relative ("img.png") — resolve against the base directory.
        $basePath = (string) ($baseParts['path'] ?? '/');
        $directory = substr($basePath, 0, (int) (strrpos($basePath, '/') ?: 0) + 1);

        return $prefix.($directory !== '' ? $directory : '/').$location;
    }

    private function safeExtension(string $mime, string $path): string
    {
        $extension = match (strtolower($mime)) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/heic' => 'heic',
            'video/mp4' => 'mp4',
            'video/quicktime' => 'mov',
            'video/webm' => 'webm',
            default => '',
        };

        if ($extension !== '') {
            return $extension;
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return preg_match('/^[a-z0-9]{1,8}$/', $extension) === 1 ? $extension : 'bin';
    }
}
