<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRecipeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $all = $this->all();
        $merge = [];

        foreach (['title', 'title_ar'] as $field) {
            if (array_key_exists($field, $all) && is_string($all[$field])) {
                $trimmed = trim($all[$field]);
                $merge[$field] = $trimmed === '' ? null : $trimmed;
            }
        }

        if (array_key_exists('steps', $all) && is_array($all['steps'])) {
            $steps = $all['steps'];
            foreach ($steps as $i => $step) {
                if (! is_array($step)) {
                    continue;
                }
                foreach (['description', 'description_ar'] as $field) {
                    if (array_key_exists($field, $step) && is_string($step[$field])) {
                        $trimmed = trim($step[$field]);
                        $steps[$i][$field] = $trimmed === '' ? null : $trimmed;
                    }
                }
            }
            $merge['steps'] = $steps;
        }

        if ($merge !== []) {
            $this->merge($merge);
        }
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
            'title' => ['sometimes', 'nullable', 'required_without:title_ar', 'string', 'max:255'],
            'title_ar' => ['sometimes', 'nullable', 'required_without:title', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'image_url' => ['nullable', 'url', 'max:500'],
            'source_url' => ['nullable', 'url', 'max:255'],
            'servings' => ['nullable', 'integer', 'min:1', 'max:50'],
            'prep_time_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'cook_time_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'ingredients' => ['nullable', 'array', 'min:1', 'max:60'],
            'ingredients.*' => ['required', 'string', 'max:300'],
            'ingredients_ar' => ['nullable', 'array', 'max:60'],
            'ingredients_ar.*' => ['required', 'string', 'max:300'],
            'ingredients_structured' => ['nullable', 'array'],
            'ingredients_structured.v' => ['nullable', 'integer', 'in:1'],
            'ingredients_structured.items' => ['nullable', 'array', 'max:60'],
            // When steps are given, the whole list replaces the old one.
            'steps' => ['nullable', 'array', 'min:1', 'max:40'],
            'steps.*.description' => ['nullable', 'required_without:steps.*.description_ar', 'string', 'max:2000'],
            'steps.*.description_ar' => ['nullable', 'required_without:steps.*.description', 'string', 'max:2000'],
            'steps.*.minutes_estimated' => ['nullable', 'integer', 'min:0', 'max:1440'],
            'steps.*.literal_minutes' => ['nullable', 'integer', 'min:0', 'max:1440'],
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
