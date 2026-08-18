<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRecipeRequest extends FormRequest
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
            'title' => ['required', 'string', 'min:1', 'max:255'],
            'title_ar' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url', 'max:500'],
            // Validated but not persisted: recipes has no servings column
            // yet (see recipereal:ai-apply's "no column yet" note).
            'servings' => ['nullable', 'integer', 'min:1', 'max:50'],
            'estimated_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'ingredients' => ['required', 'array', 'min:1', 'max:60'],
            'ingredients.*' => ['required', 'string', 'max:300'],
            // Optional Arabic ingredient lines, 1:1 with ingredients.
            'ingredients_ar' => ['nullable', 'array', 'max:60'],
            'ingredients_ar.*' => ['required', 'string', 'max:300'],
            'steps' => ['required', 'array', 'min:1', 'max:40'],
            'steps.*.description' => ['required', 'string', 'max:2000'],
            'steps.*.description_ar' => ['nullable', 'string', 'max:2000'],
            'steps.*.minutes_estimated' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'steps.*.step_type' => ['nullable', 'in:active,passive,cleanup'],
        ];
    }

    /**
     * ingredients_ar must mirror ingredients line-for-line.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $ar = $this->input('ingredients_ar');

            if (is_array($ar) && count($ar) !== count((array) $this->input('ingredients', []))) {
                $validator->errors()->add('ingredients_ar', 'ingredients_ar must have the same number of lines as ingredients.');
            }
        });
    }
}
