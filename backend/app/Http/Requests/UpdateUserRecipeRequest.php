<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRecipeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * PATCH semantics: only the provided fields are applied (nullable at
     * the top level; inner shapes match StoreUserRecipeRequest).
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'min:1', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'servings' => ['nullable', 'integer', 'min:1', 'max:50'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'ingredients' => ['nullable', 'array', 'min:1', 'max:60'],
            'ingredients.*' => ['required', 'string', 'max:300'],
            'ingredients_ar' => ['nullable', 'array', 'max:60'],
            'ingredients_ar.*' => ['required', 'string', 'max:300'],
            // When steps are given, the whole list replaces the old one.
            'steps' => ['nullable', 'array', 'min:1', 'max:40'],
            'steps.*.description' => ['required', 'string', 'max:2000'],
            'steps.*.description_ar' => ['nullable', 'string', 'max:2000'],
            'steps.*.minutes_estimated' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'steps.*.step_type' => ['nullable', 'in:active,passive,cleanup'],
        ];
    }

    /**
     * ingredients_ar, when given, must mirror the (new) ingredients list.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $ar = $this->input('ingredients_ar');
            $ingredients = $this->input('ingredients');

            if (is_array($ar) && $ingredients === null) {
                $validator->errors()->add('ingredients_ar', 'ingredients_ar requires ingredients to be provided too.');
            } elseif (is_array($ar) && is_array($ingredients) && count($ar) !== count($ingredients)) {
                $validator->errors()->add('ingredients_ar', 'ingredients_ar must have the same number of lines as ingredients.');
            }
        });
    }
}
