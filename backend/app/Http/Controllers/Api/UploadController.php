<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use Illuminate\Http\JsonResponse;
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

    public function __invoke(StoreUploadRequest $request): JsonResponse
    {
        $file = $request->file('image');

        // ULID filename: sortable, collision-free, extension from the
        // validated mime type (guessed, never the raw client name).
        $extension = strtolower($file->extension() ?: 'jpg');
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
