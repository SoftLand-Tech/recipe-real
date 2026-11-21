<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeDuplicatePair extends Model
{
    public const STATUS_FLAGGED = 'flagged';

    public const STATUS_CONFIRMED_DUPLICATE = 'confirmed_duplicate';

    public const STATUS_CONFIRMED_DISTINCT = 'confirmed_distinct';

    protected $fillable = [
        'recipe_id',
        'duplicate_of_recipe_id',
        'source',
        'status',
        'check_id',
        'decided_by',
        'note',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'decided_at' => 'datetime',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function duplicateOf(): BelongsTo
    {
        return $this->belongsTo(Recipe::class, 'duplicate_of_recipe_id');
    }

    public function check(): BelongsTo
    {
        return $this->belongsTo(DuplicateCheck::class, 'check_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
