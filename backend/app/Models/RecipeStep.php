<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecipeStep extends Model
{
    protected $fillable = [
        'recipe_id',
        'step_number',
        'description',
        'step_type',
        'publisher_minutes',
        'community_avg_minutes',
    ];

    protected function casts(): array
    {
        return [
            'step_number' => 'integer',
            'publisher_minutes' => 'decimal:2',
            'community_avg_minutes' => 'decimal:2',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function timingSubmissions(): HasMany
    {
        return $this->hasMany(TimingSubmission::class);
    }
}
