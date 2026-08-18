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
            // 4096 KB = 4 MB, matching the mobile client's compression cap.
            'image' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ];
    }
}
