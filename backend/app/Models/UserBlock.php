<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One block edge: the blocker no longer sees the blocked user's posts or
 * comments (feed filtering in PostController / PostCommentController).
 */
class UserBlock extends Model
{
    /** Append-only: created_at only, no updated_at (migration 000029). */
    public const UPDATED_AT = null;

    protected $fillable = [
        'blocker_id',
        'blocked_id',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    public function blocker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocker_id');
    }

    public function blocked(): BelongsTo
    {
        return $this->belongsTo(User::class, 'blocked_id');
    }
}
