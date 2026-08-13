<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimingSubmission extends Model
{
    protected $fillable = [
        'user_id',
        'recipe_step_id',
        'actual_minutes',
        'session_id',
    ];

    protected function casts(): array
    {
        return [
            'actual_minutes' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipeStep(): BelongsTo
    {
        return $this->belongsTo(RecipeStep::class);
    }
}
