<?php

namespace App\Services\RecipeImport;

use App\Http\Requests\CreateRecipeImportRequest;
use App\Jobs\ProcessRecipeImport;
use App\Models\RecipeImport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class RecipeImportService
{
    public function __construct(
        private readonly RecipeImportStorage $storage,
    ) {}

    public function create(
        User $user,
        CreateRecipeImportRequest $request,
    ): RecipeImport {
        $data = $request->validated();
        $primary = $request->file('primary_file');
        $extras = $request->file('extra_images', []);
        $extras = is_array($extras)
            ? array_values(array_filter($extras, fn (mixed $file): bool => $file instanceof UploadedFile))
            : [];

        return $this->createFromFiles(
            $user,
            $data['source_url'] ?? null,
            $data['provider'] ?? null,
            $primary instanceof UploadedFile ? $primary : null,
            $extras,
        );
    }

    /**
     * Queue an import from a URL, a primary upload, or both.
     *
     * This is shared by the multipart API and the Filament admin form so
     * uploads follow one storage, cleanup, and queueing path.
     *
     * @param  list<UploadedFile>  $extras
     */
    public function createFromFiles(
        User $user,
        ?string $sourceUrl = null,
        ?string $provider = null,
        ?UploadedFile $primary = null,
        array $extras = [],
    ): RecipeImport {
        if (! (bool) config('recipereal.imports.enabled', true)) {
            throw new RecipeImportException('Recipe imports are temporarily disabled.', 'imports_disabled');
        }

        $sourceUrl = trim((string) $sourceUrl);
        $sourceUrl = $sourceUrl === '' ? null : $sourceUrl;
        $platform = $this->platform((string) $sourceUrl);
        $sourceKind = $primary instanceof UploadedFile
            ? ($this->kind($primary) === 'video' ? 'video' : 'image')
            : 'url';

        $import = DB::transaction(function () use ($user, $sourceUrl, $provider, $platform, $sourceKind): RecipeImport {
            return RecipeImport::create([
                'requested_by' => $user->id,
                'status' => 'queued',
                'source_kind' => $sourceKind,
                'source_platform' => $platform,
                'source_url' => $sourceUrl,
                'source_assets' => [],
                'provider' => $provider ?: config('recipereal.ai.default', 'custom'),
                'stage' => 'queued',
                'progress' => 0,
                'expires_at' => now()->addHours((int) config('recipereal.imports.expires_hours', 24)),
            ]);
        });

        try {
            $assets = [];
            if ($primary instanceof UploadedFile) {
                $assets[] = $this->storage->storeUpload($import, $primary, 'primary');
            }
            foreach ($extras as $extra) {
                if ($extra instanceof UploadedFile) {
                    $assets[] = $this->storage->storeUpload($import, $extra, 'attachment');
                }
            }
            $import->update(['source_assets' => $assets]);
        } catch (Throwable $e) {
            $this->storage->deleteAssets($assets);
            $import->delete();

            throw new RecipeImportException(
                'The uploaded source could not be stored.',
                'source_storage_failed',
                false,
                $e,
            );
        }

        ProcessRecipeImport::dispatch($import->id)->afterCommit();

        return $import->fresh();
    }

    public function retry(RecipeImport $import): RecipeImport
    {
        if ($import->status === 'published') {
            return $import;
        }

        $import->update([
            'status' => 'queued',
            'stage' => 'queued',
            'progress' => 0,
            'draft' => null,
            'warnings' => null,
            'confidence' => null,
            'error_code' => null,
            'error_message' => null,
            'processed_at' => null,
        ]);

        ProcessRecipeImport::dispatch($import->id)->afterCommit();

        return $import->fresh();
    }

    public static function platform(string $url): ?string
    {
        if ($url === '') {
            return null;
        }

        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $host = preg_replace('/^www\./', '', $host) ?: $host;

        return match (true) {
            $host === 'tiktok.com' || str_ends_with($host, '.tiktok.com') => 'tiktok',
            $host === 'facebook.com' || str_ends_with($host, '.facebook.com')
                || $host === 'fb.watch' || str_ends_with($host, '.fb.watch') => 'facebook',
            $host === 'instagram.com' || str_ends_with($host, '.instagram.com') => 'instagram',
            $host === 'twitter.com' || str_ends_with($host, '.twitter.com')
                || $host === 'x.com' || str_ends_with($host, '.x.com') => 'x',
            $host !== '' => 'web',
            default => null,
        };
    }

    private function kind(UploadedFile $file): string
    {
        return str_starts_with((string) $file->getMimeType(), 'video/') ? 'video' : 'image';
    }
}
