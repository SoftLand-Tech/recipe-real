<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUploadRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AvatarController extends Controller
{
    private const S3_PREFIX = 'recipereal';

    public function __invoke(StoreUploadRequest $request): JsonResponse
    {
        $file = $request->file('image');
        $extension = strtolower($file->extension() ?: 'jpg');
        $filename = Str::ulid()->toBase32().'.'.$extension;

        if (config('filesystems.disks.s3.bucket') !== null) {
            $path = self::S3_PREFIX.'/avatars/'.$filename;
            Storage::disk('s3')->putFileAs(dirname($path), $file, basename($path), 'public');
            $url = Storage::disk('s3')->url($path);
        } else {
            Storage::disk('public')->putFileAs('avatars', $file, $filename);
            $url = rtrim((string) config('app.url'), '/').'/storage/avatars/'.$filename;
        }

        $user = $request->user();
        $user->avatar_url = $url;
        $user->save();

        return response()->json(['avatar_url' => $url, 'url' => $url], 201);
    }
}
