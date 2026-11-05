<?php

namespace App\Http\Requests;

use App\Models\CookSession;
use App\Models\Recipe;
use Illuminate\Contracts\Validation\Validator;
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

    /**
     * Quick-time anti-poisoning guards, checked after the schema rules pass:
     *
     * 1. 24h dedupe — one quick-time log per user per recipe per day, so a
     *    single account cannot spam the "Really takes" average. Quick-time
     *    rows are identified by cook_sessions.source = 'quick' (full Cook
     *    Mode sessions keep their unrestricted path).
     * 2. Sanity rejection — once >= 5 real sessions exist, a quick-time
     *    deviating more than 5x from the measured reality_minutes is
     *    rejected: it would distort the community average; Cook Mode is the
     *    trusted path for genuinely unusual timings.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                // Schema rules already failed; skip the business checks.
                return;
            }

            $recipe = $this->route('recipe');
            $user = $this->user();
            if (! $recipe instanceof Recipe || $user === null) {
                return;
            }

            // 1. One quick-time log per user per recipe per 24h.
            $alreadyLogged = CookSession::query()
                ->where('user_id', $user->id)
                ->where('recipe_id', $recipe->id)
                ->where('source', 'quick')
                ->where('created_at', '>=', now()->subHours(24))
                ->exists();

            if ($alreadyLogged) {
                $validator->errors()->add(
                    'minutes',
                    'You already logged a time for this recipe today. You can log again tomorrow.'
                );

                return;
            }

            // 2. Sanity check against the community-measured reality.
            $reality = $recipe->reality_minutes;
            if ($reality === null || (int) $recipe->reality_samples < 5) {
                return;
            }

            $minutes = (float) $this->input('minutes');
            $realityMinutes = (float) $reality;

            if ($minutes > $realityMinutes * 5 || $minutes < $realityMinutes / 5) {
                $validator->errors()->add(
                    'minutes',
                    sprintf(
                        'That time is far from what cooks measured for this recipe (%s min). If that is accurate, use Cook Mode so it counts fully.',
                        (string) $realityMinutes,
                    )
                );
            }
        });
    }
}
