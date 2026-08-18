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
        'description_ar',
        'step_type',
        'publisher_minutes',
        'community_avg_minutes',
        // User recipes store their per-step estimate here; the AI pipeline
        // (recipereal:ai-apply) writes the same column for imported rows.
        'ai_minutes',
        // Minutes literally stated in the step's source text (the app's
        // cooking-mode alarm anchor). null when the step states no time.
        'literal_minutes',
    ];

    protected function casts(): array
    {
        return [
            'step_number' => 'integer',
            'publisher_minutes' => 'decimal:2',
            'community_avg_minutes' => 'decimal:2',
            'ai_minutes' => 'decimal:2',
            'literal_minutes' => 'decimal:2',
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
