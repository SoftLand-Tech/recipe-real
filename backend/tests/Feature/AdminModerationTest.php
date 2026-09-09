<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use App\Services\ModerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the admin moderation system (ModerationService + ban enforcement):
 *
 *   1. Dismissing reports clears the rows and keeps the content.
 *   2. Removing a post/comment deletes the content, clears its reports and
 *      leaves a `moderation` inbox notice for the author.
 *   3. Banning suspends the account, revokes tokens and notifies the user;
 *      unbanning lifts it.
 *   4. Banned users get 403 on authed routes and cannot sign in again.
 */
class AdminModerationTest extends TestCase
{
    use RefreshDatabase;

    public function test_dismiss_post_reports_keeps_the_post(): void
    {
        $author = User::factory()->create();
        $reporter = User::factory()->create();
        $post = Post::create(['user_id' => $author->id, 'body' => 'Keep me.']);

        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/report", ['reason' => 'spam'])
            ->assertStatus(201);

        $cleared = app(ModerationService::class)->dismissPostReports($post);

        $this->assertSame(1, $cleared);
        $this->assertDatabaseCount('post_reports', 0);
        $this->assertDatabaseHas('posts', ['id' => $post->id]);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_remove_post_notifies_author_and_clears_reports(): void
    {
        $author = User::factory()->create();
        $reporter = User::factory()->create();
        $post = Post::create(['user_id' => $author->id, 'body' => 'Remove me please.']);

        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/report", ['reason' => 'spam'])
            ->assertStatus(201);

        app(ModerationService::class)->removePost($post, 'spam');

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
        $this->assertDatabaseCount('post_reports', 0);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $author->id,
            'type' => 'moderation',
            'post_id' => null,
        ]);

        $notice = Notification::query()
            ->where('user_id', $author->id)
            ->where('type', 'moderation')
            ->firstOrFail();
        $this->assertStringContainsString('spam', (string) $notice->message);
    }

    public function test_remove_comment_keeps_post_link_in_notice(): void
    {
        $author = User::factory()->create();
        $reporter = User::factory()->create();
        $post = Post::create(['user_id' => $author->id, 'body' => 'Thread.']);
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $reporter->id,
            'body' => 'Rude.',
        ]);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments/{$comment->id}/report")
            ->assertStatus(201);

        app(ModerationService::class)->removeComment($comment, 'harassment');

        $this->assertDatabaseMissing('post_comments', ['id' => $comment->id]);
        $this->assertDatabaseCount('comment_reports', 0);
        // The post survives, so the notice links to it.
        $this->assertDatabaseHas('notifications', [
            'user_id' => $reporter->id,
            'type' => 'moderation',
            'post_id' => $post->id,
        ]);
    }

    public function test_ban_revokes_tokens_notifies_and_blocks_api(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile')->plainTextToken;

        app(ModerationService::class)->banUser($user, 'spam');

        $user->refresh();
        $this->assertTrue($user->isBanned());
        $this->assertSame('spam', $user->ban_reason);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $user->id,
            'type' => 'moderation',
        ]);

        // Old token is gone: 401. And even a fresh token is rejected: 403.
        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/notifications')
            ->assertStatus(401);

        $fresh = $user->createToken('mobile')->plainTextToken;
        $this->withHeader('Authorization', "Bearer {$fresh}")
            ->getJson('/api/notifications')
            ->assertStatus(403)
            ->assertJsonPath('code', 'account_suspended');

        // Public reads are unaffected.
        $this->getJson('/api/posts')->assertOk();
    }

    public function test_banned_user_cannot_report(): void
    {
        $author = User::factory()->create();
        $banned = User::factory()->create();
        $post = Post::create(['user_id' => $author->id, 'body' => 'Hello.']);

        app(ModerationService::class)->banUser($banned);

        $this->actingAs($banned, 'sanctum')
            ->postJson("/api/posts/{$post->id}/report")
            ->assertStatus(403);

        $this->assertDatabaseCount('post_reports', 0);
    }

    public function test_unban_lifts_suspension(): void
    {
        $user = User::factory()->create();

        app(ModerationService::class)->banUser($user, 'spam');
        $this->assertTrue($user->refresh()->isBanned());

        app(ModerationService::class)->unbanUser($user);

        $user->refresh();
        $this->assertFalse($user->isBanned());
        $this->assertNull($user->ban_reason);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/notifications')
            ->assertOk();
    }
}
