<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest
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
            'kind' => ['required', 'in:try,fail,question'],
            'body' => ['required', 'string', 'min:1', 'max:2000'],
            'recipe_id' => ['nullable', 'integer', 'exists:recipes,id'],
            'image_url' => ['nullable', 'url', 'max:500'],
        ];
    }
}
