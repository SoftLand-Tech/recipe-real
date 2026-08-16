<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreQuickTimeRequest extends FormRequest
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
            // Total actual time (hands-on + passive).
            'minutes' => ['required', 'numeric', 'min:1', 'max:1440'],
            // Optional v2 breakdown: cleanup time, active hands-on time
            // (never more than the total) and plates made.
            'cleanup_minutes' => ['nullable', 'numeric', 'min:0', 'max:1440'],
            'hands_on_minutes' => ['nullable', 'numeric', 'min:0', 'max:1440', 'lte:minutes'],
            'servings' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
