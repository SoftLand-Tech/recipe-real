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

    /**
     * The engine's way of flagging a collision (backfill, publish-time
     * indexing, reference scan): idempotent, and NEVER regresses a human
     * decision — once a pair is confirmed_duplicate / confirmed_distinct
     * (recipereal:dedup-review / Filament review UI), engine re-runs leave
     * the records untouched; only still-`flagged` rows get their note
     * refreshed.
     *
     * @return bool true when a NEW pair was created (fresh flag)
     */
    public static function flagFromEngine(
        int $recipeId,
        int $duplicateOfRecipeId,
        string $source,
        string $note,
    ): bool {
        $pair = static::query()->firstOrCreate(
            [
                'recipe_id' => $recipeId,
                'duplicate_of_recipe_id' => $duplicateOfRecipeId,
            ],
            [
                'source' => $source,
                'status' => self::STATUS_FLAGGED,
                'note' => $note,
            ],
        );

        if ($pair->wasRecentlyCreated) {
            return true;
        }

        if ($pair->status === self::STATUS_FLAGGED) {
            $pair->forceFill(['note' => $note])->save();
        }

        return false;
    }
}
