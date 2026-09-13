<?php

namespace App\Http\Requests;

use App\Services\RecipeImport\PublicUrlGuard;
use Illuminate\Foundation\Http\FormRequest;
use Throwable;

class CreateRecipeImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $maxVideo = (int) config('recipereal.imports.max_video_mb', 100) * 1024;
        $maxImage = (int) config('recipereal.imports.max_image_mb', 8) * 1024;
        $maxImages = (int) config('recipereal.imports.max_images', 6);

        return [
            'source_url' => ['nullable', 'url', 'max:2000'],
            'provider' => ['nullable', 'string', 'max:80', 'regex:/^[a-z0-9_-]+$/i'],
            'primary_file' => [
                'nullable',
                'file',
                'mimes:jpg,jpeg,png,webp,heic,mp4,mov,m4v,webm',
                'max:'.max($maxVideo, $maxImage),
            ],
            'extra_images' => ['nullable', 'array', 'max:'.$maxImages],
            'extra_images.*' => ['file', 'mimes:jpg,jpeg,png,webp,heic', 'max:'.$maxImage],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('source_url')) {
            $this->merge(['source_url' => trim((string) $this->input('source_url')) ?: null]);
        }
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if (! $this->filled('source_url') && ! $this->hasFile('primary_file')) {
                $validator->errors()->add('source', 'Provide a public URL or a primary image/video.');
            }

            if ($this->filled('source_url')) {
                try {
                    app(PublicUrlGuard::class)->assertPublic((string) $this->input('source_url'));
                } catch (Throwable $e) {
                    $validator->errors()->add('source_url', $e->getMessage());
                }
            }

            $file = $this->file('primary_file');
            if ($file === null || ! $file->isValid()) {
                return;
            }

            $maxMb = str_starts_with((string) $file->getMimeType(), 'video/')
                ? (int) config('recipereal.imports.max_video_mb', 100)
                : (int) config('recipereal.imports.max_image_mb', 8);

            if (($file->getSize() ?: 0) > ($maxMb * 1024 * 1024)) {
                $validator->errors()->add(
                    'primary_file',
                    'The uploaded file exceeds the configured size limit of '.$maxMb.' MB.',
                );
            }
        });
    }
}
