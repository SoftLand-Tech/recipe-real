<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DuplicateCheck extends Model
{
    public const SOURCE_GENERATION = 'generation';

    public const SOURCE_BACKFILL = 'backfill';

    public const SOURCE_MANUAL = 'manual';

    public const ACTION_ACCEPTED = 'accepted';

    public const ACTION_REJECTED_DUPLICATE = 'rejected_duplicate';

    public const ACTION_FLAGGED_REVIEW = 'flagged_review';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_NEEDS_REVIEW = 'needs_review';

    protected $fillable = [
        'recipe_id',
        'matched_recipe_id',
        'batch_id',
        'source',
        'layer',
        'action',
        'is_duplicate',
        'scores',
        'classification',
        'ai_confidence',
        'reason',
        'differences',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'scores' => 'array',
            'differences' => 'array',
            'layer' => 'integer',
            'ai_confidence' => 'float',
            'is_duplicate' => 'boolean',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function matchedRecipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class, 'matched_recipe_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(RecipeGenerationBatch::class, 'batch_id');
    }

    public function pairs(): HasMany
    {
        return $this->hasMany(RecipeDuplicatePair::class, 'check_id');
    }
}
