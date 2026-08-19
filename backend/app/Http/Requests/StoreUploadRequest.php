<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUploadRequest extends FormRequest
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
            // 6144 KB = 6 MB. Phone photos at picker quality 0.8 commonly
            // land 1.5–4 MB (48MP shots can exceed 4); the server stack is
            // configured for 12M upload / 16M post (nginx client_max_body_size
            // 16M) — this validation is the app-level cap beneath them.
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:6144'],
        ];
    }
}
