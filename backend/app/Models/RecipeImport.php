<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeImport extends Model
{
    protected $fillable = [
        'requested_by',
        'published_by',
        'recipe_id',
        'status',
        'source_kind',
        'source_platform',
        'source_url',
        'source_assets',
        'provider',
        'provider_model',
        'stage',
        'progress',
        'draft',
        'warnings',
        'confidence',
        'error_code',
        'error_message',
        'processed_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'source_assets' => 'array',
            'draft' => 'array',
            'warnings' => 'array',
            'confidence' => 'array',
            'progress' => 'integer',
            'processed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }
}
