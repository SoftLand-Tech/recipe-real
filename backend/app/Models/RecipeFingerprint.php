<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RecipeFingerprint extends Model
{
    protected $fillable = [
        'recipe_id',
        'version',
        'fingerprint',
        'identity_signature',
        'ingredient_combo_hash',
        'main_ingredient_hash',
        'title_signature',
        'dish_family',
        'cuisine',
        'category',
        'form',
        'sauce',
        'identity',
        'is_complete',
    ];

    protected function casts(): array
    {
        return [
            'identity' => 'array',
            'version' => 'integer',
            'is_complete' => 'boolean',
        ];
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }
}
