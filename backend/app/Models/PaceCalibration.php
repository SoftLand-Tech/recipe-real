<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaceCalibration extends Model
{
    protected $fillable = [
        'user_id',
        'step_type',
        'personal_avg_minutes',
        'community_avg_minutes',
        'confidence',
    ];

    protected function casts(): array
    {
        return [
            'personal_avg_minutes' => 'decimal:2',
            'community_avg_minutes' => 'decimal:2',
            'confidence' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
