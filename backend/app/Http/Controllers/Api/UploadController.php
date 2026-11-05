<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Image uploads for community content (recipe photos, post photos):
 * multipart POST /api/uploads → {url}.
 *
 * Files land in the S3-compatible object store (Hetzner Object Storage;
 * any S3 endpoint via the AWS_* env keys) under the recipereal/ prefix of
 * the shared bucket — keeps the VPS disk flat. The returned URL is the
 * bucket's public URL (AWS_URL env); the bucket policy grants anonymous
 * reads on the recipereal/ prefix only. Falls back to the local public
 * disk when S3 is not configured, so dev setups without credentials
 * keep working exactly as before.
 */
class UploadController extends Controller
{
    /** Object-storage key prefix — isolates this app inside the shared bucket. */
    private const S3_PREFIX = 'recipereal';

    /**
     * Extension is derived from the VALIDATED CONTENT mime type, never
     * from the client's filename or its guessed extension (H6): a crafted
     * "photo.php" upload with PNG content stores as .png or is rejected —
     * it can never keep a scriptable extension on the object store.
     */
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    /** Daily per-user upload cap (H6 abuse bound; UTC day). */
    private const DAILY_UPLOAD_LIMIT = 20;

    public function __invoke(StoreUploadRequest $request): JsonResponse
    {
        $file = $request->file('image');

        // Content mime (finfo on the bytes) → fixed extension map. Null
        // means the validated file is not one of the three allowed image
        // types, so refuse BEFORE burning a quota unit — rejected junk
        // should not count against the user's daily cap.
        $mime = strtolower((string) ($file->getMimeType() ?: ''));
        $extension = self::MIME_EXTENSIONS[$mime] ?? null;

        if ($extension === null) {
            return response()->json([
                'message' => 'Unsupported image type.',
            ], 422);
        }

        // Quota: the counter lives until the end of the UTC day and
        // increments per ACCEPTED upload; the 21st of the day → 429. add()
        // seeds the key (no-op when it already exists for today).
        $dayKey = 'uploads:day:'.$request->user()->id.':'.now()->utc()->toDateString();
        Cache::add($dayKey, 0, now()->utc()->endOfDay());

        if (Cache::increment($dayKey) > self::DAILY_UPLOAD_LIMIT) {
            return response()->json([
                'message' => 'Daily upload limit reached.',
            ], 429);
        }

        // ULID filename: sortable, collision-free, extension from the
        // validated CONTENT mime via the fixed map above (never the raw
        // client name — that value is display metadata, not a promise).
        $filename = Str::ulid()->toBase32().'.'.$extension;

        if (config('filesystems.disks.s3.bucket') !== null) {
            $path = self::S3_PREFIX.'/recipes/'.$filename;
            Storage::disk('s3')->putFileAs(
                dirname($path),
                $file,
                basename($path),
                'public',
            );

            return response()->json([
                'url' => Storage::disk('s3')->url($path),
            ], 201);
        }

        // Legacy local path (dev / unset S3 env): unchanged behavior.
        Storage::disk('public')->putFileAs('recipes', $file, $filename);

        return response()->json([
            'url' => rtrim((string) config('app.url'), '/').'/storage/recipes/'.$filename,
        ], 201);
    }
}
