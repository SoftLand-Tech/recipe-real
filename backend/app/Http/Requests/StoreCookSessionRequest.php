<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCookSessionRequest extends FormRequest
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
            'recipe_id' => ['required', 'integer', 'exists:recipes,id'],
            'total_actual_minutes' => ['required', 'numeric', 'min:0'],
            'cleanup_minutes' => ['nullable', 'numeric', 'min:0'],
            'feedback' => ['nullable', 'in:faster,as_expected,slower'],
            'idempotency_key' => ['nullable', 'uuid'],
            'timing_submissions' => ['required', 'array', 'min:1'],
            'timing_submissions.*.recipe_step_id' => ['required', 'integer', 'exists:recipe_steps,id'],
            'timing_submissions.*.actual_minutes' => ['required', 'numeric', 'min:0'],
        ];
    }
}
