<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CookSession extends Model
{
    protected $fillable = [
        'user_id',
        'recipe_id',
        'total_actual_minutes',
        'cleanup_minutes',
        'feedback',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'total_actual_minutes' => 'decimal:2',
            'cleanup_minutes' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }
}
