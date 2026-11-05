<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PublishRecipeImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:1', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'source_url' => ['nullable', 'url', 'max:255'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'servings' => ['nullable', 'integer', 'min:1', 'max:50'],
            'estimated_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'prep_time_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'cook_time_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'ingredients' => ['required', 'array', 'min:1', 'max:60'],
            'ingredients.*' => ['required', 'string', 'max:300'],
            'ingredients_ar' => ['nullable', 'array', 'max:60'],
            'ingredients_ar.*' => ['required', 'string', 'max:300'],
            'ingredients_structured' => ['nullable', 'array'],
            'ingredients_structured.v' => ['nullable', 'integer', 'in:1'],
            'ingredients_structured.items' => ['nullable', 'array', 'max:60'],
            'steps' => ['required', 'array', 'min:1', 'max:40'],
            'steps.*.description' => ['required', 'string', 'max:2000'],
            'steps.*.description_ar' => ['nullable', 'string', 'max:2000'],
            'steps.*.minutes_estimated' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'steps.*.literal_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'steps.*.step_type' => ['nullable', 'in:active,passive,cleanup'],
            'category' => ['nullable', 'string', 'max:255'],
            'keywords' => ['nullable', 'array', 'max:30'],
            'keywords.*' => ['string', 'max:80'],
            'calories' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'protein_g' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'fat_g' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $ar = $this->input('ingredients_ar');
            $ingredients = $this->input('ingredients', []);

            if (is_array($ar) && count($ar) !== count((array) $ingredients)) {
                $validator->errors()->add('ingredients_ar', 'ingredients_ar must have the same number of lines as ingredients.');
            }

            // M7 image-host allowlist: a shape-valid image_url must still
            // point at a host this app controls.
            $url = $this->input('image_url');

            if (is_string($url) && $url !== '' && ! $this->imageUrlAllowed($url)) {
                $validator->errors()->add('image_url', 'The image URL host is not allowed.');
            }
        });
    }

    /**
     * Remote image URLs must be https and point at an allowlisted host:
     * the app.url host, the S3 AWS_URL host, plus extras from
     * recipereal.uploads.allowed_image_hosts (env fallback:
     * UPLOAD_ALLOWED_IMAGE_HOSTS — read directly so the guard works even
     * before a config deploy). Exact host match only.
     */
    private function imageUrlAllowed(string $url): bool
    {
        $parts = parse_url($url);

        if (($parts['scheme'] ?? '') !== 'https') {
            return false;
        }

        $host = strtolower((string) ($parts['host'] ?? ''));

        // Port pinning: an allowlisted host on any port other than 443 is a
        // different surface (https://host:8443 must not pass).
        $port = $parts['port'] ?? null;
        if ($port !== null && (int) $port !== 443) {
            return false;
        }

        return $host !== '' && in_array($host, $this->allowedImageHosts(), true);
    }

    /**
     * @return list<string>
     */
    private function allowedImageHosts(): array
    {
        $hosts = [];

        foreach ([
            parse_url((string) config('app.url'), PHP_URL_HOST),
            parse_url((string) config('filesystems.disks.s3.url'), PHP_URL_HOST),
        ] as $host) {
            if (is_string($host) && $host !== '') {
                $hosts[] = strtolower($host);
            }
        }

        $extra = config('recipereal.uploads.allowed_image_hosts');
        $extra = is_array($extra) ? $extra : [];

        foreach ($extra as $host) {
            $host = strtolower(trim((string) $host));

            if ($host !== '') {
                $hosts[] = $host;
            }
        }

        return array_values(array_unique($hosts));
    }
}
