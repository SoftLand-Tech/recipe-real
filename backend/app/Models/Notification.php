<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One in-app notification-center row ("X liked your post" /
 * "X commented on your post"). Append-only: created_at only (no
 * updated_at), like PostComment. Unread rows have read_at = null.
 */
class Notification extends Model
{
    /** See migration 000030: like|comment. */
    public const TYPES = ['like', 'comment'];

    /** created_at only — no updated_at column. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'type',
        'actor_id',
        'post_id',
        'read_at',
        'created_at',
    ];

    /**
     * @var array<string, string>
     */
    protected $casts = [
        'read_at' => 'datetime',
    ];

    /** The recipient — whose notification box this row lives in. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Who liked/commented (null once the actor deleted their account). */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    /** The post the event happened on (null once the post is deleted). */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
