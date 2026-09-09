<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PostComment extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'body',
    ];

    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
            // Editable since migration 000029 (updated_at added; legacy rows
            // keep null and therefore never read as "edited").
            'updated_at' => 'datetime',
        ];
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Moderation reports filed against this comment (append-only rows from
     * PostCommentController::report). Cascade-deleted with the comment.
     */
    public function reports(): HasMany
    {
        return $this->hasMany(CommentReport::class, 'post_comment_id');
    }
}
