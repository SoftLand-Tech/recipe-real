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
        });
    }
}
