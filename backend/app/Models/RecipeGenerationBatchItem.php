<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeGenerationBatchItem extends Model
{
    public const ACTION_ACCEPTED = 'accepted';

    public const ACTION_DUPLICATE = 'duplicate';

    public const ACTION_NEEDS_REVIEW = 'needs_review';

    public const ACTION_GENERATION_FAILED = 'generation_failed';

    protected $fillable = [
        'batch_id',
        'recipe_id',
        'check_id',
        'action',
        'title',
        'matched_recipe_id',
        'layer',
        'score',
        'reason',
        'candidate_summary',
    ];

    protected function casts(): array
    {
        return [
            'score' => 'float',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(RecipeGenerationBatch::class, 'batch_id');
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function check(): BelongsTo
    {
        return $this->belongsTo(DuplicateCheck::class, 'check_id');
    }
}
