<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Post extends Model
{
    protected $fillable = [
        'user_id',
        'body',
        'recipe_id',
        'image_url',
        'images',
    ];

    /**
     * Cast the JSON `images` column to/from a PHP array automatically.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'images' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipe(): BelongsTo
    {
        return $this->belongsTo(Recipe::class);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(PostLike::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(PostComment::class);
    }

    /**
     * The newest comment on this post (hasOne ordered by id desc). Eager-
     * loaded by PostController::index/show so feed rows can embed a
     * latest-comment preview in ONE extra query per page instead of an
     * N+1 of per-post comment fetches on the client.
     */
    public function latestComment(): HasOne
    {
        return $this->hasOne(PostComment::class)->latest('id');
    }
}
