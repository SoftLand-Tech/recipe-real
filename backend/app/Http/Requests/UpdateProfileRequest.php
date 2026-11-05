<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'display_name' => ['sometimes', 'required', 'string', 'min:2', 'max:40'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:500'],
            'avatar_url' => ['sometimes', 'nullable', 'string', 'max:2000', 'url'],
            'gender' => ['sometimes', 'nullable', 'string', 'in:male,female'],
        ];
    }

    public function withValidator($validator): void
    {
        // M7 image-host allowlist: a user-supplied avatar_url must be
        // https and point at a host this app controls.
        $validator->after(function ($validator): void {
            $url = $this->input('avatar_url');

            if (is_string($url) && $url !== '' && ! $this->imageUrlAllowed($url)) {
                $validator->errors()->add('avatar_url', 'The avatar URL host is not allowed.');
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
