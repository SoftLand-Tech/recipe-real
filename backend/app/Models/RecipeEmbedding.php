<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeEmbedding extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_INDEXED = 'indexed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'recipe_id',
        'status',
        'model',
        'dimensions',
        'text_hash',
        'attempts',
        'last_error',
        'indexed_at',
    ];

    protected function casts(): array
    {
        return [
            'attempts' => 'integer',
            'dimensions' => 'integer',
            'indexed_at' => 'datetime',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }
}
