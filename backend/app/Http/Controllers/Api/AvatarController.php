<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use App\Support\ShareCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class AvatarController extends Controller
{
    private const S3_PREFIX = 'recipereal';

    /**
     * Extension is derived from the VALIDATED CONTENT mime type, never
     * from the client's filename (same hardening as UploadController H6).
     */
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public function __invoke(StoreUploadRequest $request): JsonResponse
    {
        $file = $request->file('image');
        $user = $request->user();

        // M7: the avatar URL we are about to store must point at an
        // allowlisted host (app.url / S3 AWS_URL / UPLOAD_ALLOWED_IMAGE_HOSTS).
        // The URL is constructed below, so this is a self-check that keeps
        // the endpoint safe if the storage config ever drifts.
        $mime = strtolower((string) ($file->getMimeType() ?: ''));
        $extension = self::MIME_EXTENSIONS[$mime] ?? null;

        if ($extension === null) {
            return response()->json(['message' => 'Unsupported image type.'], 422);
        }

        $filename = Str::ulid()->toBase32().'.'.$extension;

        if (config('filesystems.disks.s3.bucket') !== null) {
            $path = self::S3_PREFIX.'/avatars/'.$filename;
            Storage::disk('s3')->putFileAs(dirname($path), $file, basename($path), 'public');
            $url = Storage::disk('s3')->url($path);
        } else {
            Storage::disk('public')->putFileAs('avatars', $file, $filename);
            $url = rtrim((string) config('app.url'), '/').'/storage/avatars/'.$filename;
        }

        if (! $this->avatarUrlAllowed($url)) {
            return response()->json(['message' => 'The avatar URL host is not allowed.'], 422);
        }

        // Replacing an avatar? Best-effort delete of the PREVIOUS object so
        // abandoned files don't pile up in the bucket — only when the old
        // URL lives on the bucket's own host (old Google-avatar URLs etc.
        // must never be touched), and a failed cleanup never blocks the
        // new avatar from being set.
        $oldUrl = (string) ($user->avatar_url ?? '');

        if ($oldUrl !== '') {
            $oldHost = strtolower((string) parse_url($oldUrl, PHP_URL_HOST));
            $bucketHost = strtolower((string) parse_url((string) config('filesystems.disks.s3.url'), PHP_URL_HOST));

            if ($bucketHost !== '' && $oldHost === $bucketHost) {
                try {
                    $key = ltrim((string) parse_url($oldUrl, PHP_URL_PATH), '/');

                    if ($key !== '') {
                        Storage::disk('s3')->delete($key);
                    }
                } catch (Throwable) {
                    // Orphaned file is acceptable; the new avatar wins.
                }
            }
        }

        $user->avatar_url = $url;
        $user->save();

        // The avatar renders on every /p/{id} the user authored.
        ShareCache::forgetPostsByUser($user->id);

        return response()->json(['avatar_url' => $url, 'url' => $url], 201);
    }

    /**
     * Allowlisted https host (M7): app.url host, S3 AWS_URL host, plus
     * extras from recipereal.uploads.allowed_image_hosts (env fallback:
     * UPLOAD_ALLOWED_IMAGE_HOSTS). Exact host match only.
     *
     * The one https carve-out is the app's OWN configured origin: the URL
     * here is constructed in-code two lines above (never user-supplied),
     * and in dev that origin is http://localhost — rejecting our own
     * config-shaped URL would kill dev avatar uploads with no security
     * gain. Everything else must be https.
     */
    private function avatarUrlAllowed(string $url): bool
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower((string) ($parts['host'] ?? ''));

        if ($host === '') {
            return false;
        }

        $appParts = parse_url((string) config('app.url'));
        $appOrigin = strtolower((string) ($appParts['scheme'] ?? '')).'://'.strtolower((string) ($appParts['host'] ?? ''))
            .(isset($appParts['port']) ? ':'.$appParts['port'] : '');

        if ($scheme !== 'https' && ! str_starts_with(strtolower($url), strtolower($appOrigin))) {
            return false;
        }

        // Port pinning (non-app-origin): allowlisted hosts on other ports
        // are different surfaces. The dev carve-out above keeps its port.
        $port = $parts['port'] ?? null;
        if ($port !== null && (int) $port !== 443 && ! str_starts_with(strtolower($url), strtolower($appOrigin))) {
            return false;
        }

        $hosts = [];

        foreach ([
            parse_url((string) config('app.url'), PHP_URL_HOST),
            parse_url((string) config('filesystems.disks.s3.url'), PHP_URL_HOST),
        ] as $allowlisted) {
            if (is_string($allowlisted) && $allowlisted !== '') {
                $hosts[] = strtolower($allowlisted);
            }
        }

        $extra = config('recipereal.uploads.allowed_image_hosts');
        $extra = is_array($extra) ? $extra : [];

        foreach ($extra as $allowlisted) {
            $allowlisted = strtolower(trim((string) $allowlisted));

            if ($allowlisted !== '') {
                $hosts[] = $allowlisted;
            }
        }

        return in_array($host, array_values(array_unique($hosts)), true);
    }
}
