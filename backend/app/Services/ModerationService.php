<?php

namespace App\Services;

use App\Models\CommentReport;
use App\Models\Notification;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostReport;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * Community moderation primitives shared by the Filament admin panel.
 *
 * Every state change is explicit and auditable from the caller's side:
 * dismissing clears report rows and keeps the content; removing deletes the
 * content (its report rows disappear via their cascade FKs) and leaves a
 * `moderation` notification in the author's inbox; banning suspends the
 * account and revokes its API tokens.
 */
class ModerationService
{
    /**
     * Dismiss all reports against a post; the post stays up.
     *
     * @return int number of report rows cleared
     */
    public function dismissPostReports(Post $post): int
    {
        return PostReport::query()->where('post_id', $post->id)->delete();
    }

    /**
     * Remove a post as a moderator: clear its reports, notify the author,
     * then delete it. The notice carries post_id = null — notifications are
     * cascade-deleted with their post, so linking it would erase the notice
     * the moment the post is gone.
     */
    public function removePost(Post $post, ?string $reason = null): void
    {
        $authorId = $post->user_id;
        $snippet = Str::limit((string) $post->body, 80);

        $this->dismissPostReports($post);

        Notification::create([
            'user_id' => $authorId,
            'type' => 'moderation',
            'actor_id' => null,
            'post_id' => null,
            'message' => $this->takedownMessage('post', $snippet, $reason),
        ]);

        $post->delete();
    }

    /**
     * Dismiss all reports against a comment; the comment stays up.
     *
     * @return int number of report rows cleared
     */
    public function dismissCommentReports(PostComment $comment): int
    {
        return CommentReport::query()->where('post_comment_id', $comment->id)->delete();
    }

    /**
     * Remove a comment as a moderator: clear its reports, notify the author,
     * then delete it. The notice keeps post_id (the post survives) so the
     * author's inbox row still opens the thread.
     */
    public function removeComment(PostComment $comment, ?string $reason = null): void
    {
        $this->dismissCommentReports($comment);

        Notification::create([
            'user_id' => $comment->user_id,
            'type' => 'moderation',
            'actor_id' => null,
            'post_id' => $comment->post_id,
            'message' => $this->takedownMessage('comment', Str::limit((string) $comment->body, 80), $reason),
        ]);

        $comment->delete();
    }

    /**
     * Suspend an account: stamp banned_at/ban_reason and revoke every API
     * token so the user is signed out on all devices immediately. The user
     * gets a moderation notice explaining the suspension.
     */
    public function banUser(User $user, ?string $reason = null): void
    {
        $user->forceFill([
            'banned_at' => now(),
            'ban_reason' => $reason,
        ])->save();

        $user->tokens()->delete();

        Notification::create([
            'user_id' => $user->id,
            'type' => 'moderation',
            'actor_id' => null,
            'post_id' => null,
            'message' => $reason !== null && trim($reason) !== ''
                ? "Your account has been suspended by a moderator: {$reason}"
                : 'Your account has been suspended by a moderator.',
        ]);
    }

    /**
     * Lift a suspension. Tokens stay revoked — the user signs in again.
     */
    public function unbanUser(User $user): void
    {
        $user->forceFill([
            'banned_at' => null,
            'ban_reason' => null,
        ])->save();
    }

    private function takedownMessage(string $kind, string $snippet, ?string $reason): string
    {
        $base = $snippet !== ''
            ? "A moderator removed your {$kind}: \"{$snippet}\""
            : "A moderator removed your {$kind}";

        return $reason !== null && trim($reason) !== ''
            ? "{$base}. Reason: {$reason}"
            : "{$base}.";
    }
}
