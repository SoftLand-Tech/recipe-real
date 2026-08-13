<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    protected $fillable = [
        'title',
        'source_url',
        'ingredients',
        'steps',
        'publisher_time_minutes',
        'community_avg_minutes',
        'cleanup_avg_minutes',
    ];

    protected function casts(): array
    {
        return [
            'ingredients' => 'array',
            'steps' => 'array',
            'publisher_time_minutes' => 'integer',
            'community_avg_minutes' => 'decimal:2',
            'cleanup_avg_minutes' => 'decimal:2',
        ];
    }

    public function recipeSteps(): HasMany
    {
        return $this->hasMany(RecipeStep::class)->orderBy('step_number');
    }

    public function cookSessions(): HasMany
    {
        return $this->hasMany(CookSession::class);
    }
}
