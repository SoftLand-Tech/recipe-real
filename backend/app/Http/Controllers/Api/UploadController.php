<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Image uploads for community content (recipe photos, post photos):
 * multipart POST /api/uploads → {url}. Files land on the public disk under
 * storage/app/public/recipes/{ulid}.{ext}; the URL is served through the
 * /storage symlink (run `php artisan storage:link` on the VPS once).
 */
class UploadController extends Controller
{
    public function __invoke(StoreUploadRequest $request): JsonResponse
    {
        $file = $request->file('image');

        // ULID filename: sortable, collision-free, extension from the
        // validated mime type (guessed, never the raw client name).
        $extension = strtolower($file->extension() ?: 'jpg');
        $filename = Str::ulid()->toBase32().'.'.$extension;

        Storage::disk('public')->putFileAs('recipes', $file, $filename);

        return response()->json([
            'url' => rtrim((string) config('app.url'), '/').'/storage/recipes/'.$filename,
        ], 201);
    }
}
