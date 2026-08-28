<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * One distributable APK build. Uploaded through the admin panel's
 * "App releases" page; the newest row is what GET /download serves.
 * Files live on the PRIVATE local disk — the route streams them, the
 * storage dir itself is never web-served.
 */
class AppRelease extends Model
{
    protected $fillable = [
        'version',
        'file_path',
        'file_size',
        'sha256',
        'notes',
        'uploaded_by',
    ];

    /** The release /download currently serves (newest row). */
    public static function latest(): ?self
    {
        return static::query()->latest('id')->first();
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Human size ("36.2 MB" / "812 KB") for the landing + admin tables. */
    public function humanSize(): string
    {
        $mb = $this->file_size / 1024 / 1024;

        return $mb >= 1
            ? number_format($mb, 1).' MB'
            : number_format($mb * 1024).' KB';
    }

    /** Absolute download URL of this release file. */
    public function downloadUrl(): string
    {
        return route('app.download');
    }

    /** Stream helper used by the /download route. */
    public function toDownloadResponse()
    {
        $disk = Storage::disk('local');

        return response()->download(
            $disk->path($this->file_path),
            "RecipeReal-{$this->version}.apk",
            [
                'Content-Type' => 'application/vnd.android.package-archive',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }
}
