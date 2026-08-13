<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalyticsEvent extends Model
{
    /**
     * Append-only log: never update a row, so disable updated_at entirely.
     */
    public const UPDATED_AT = null;

    protected $table = 'analytics_events';

    protected $fillable = [
        'user_id',
        'name',
        'properties',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'properties' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
