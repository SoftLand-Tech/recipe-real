<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Covers the in-app notification center:
 *
 *   1. Liking someone's post creates exactly ONE 'like' notification for the
 *      author (actor = liker); self-likes never notify.
 *   2. Un-liking creates nothing (and leaves old notifications alone);
 *      re-liking after an unlike creates a new row (acceptable v1).
 *   3. Commenting on someone's post notifies the author once; commenting on
 *      your own post never notifies.
 *   4. GET /api/notifications pages the inbox newest-first (20/page) with
 *      actor + post snippet rows and meta.unread_count.
 *   5. POST /api/notifications/read marks ONLY the caller's unread rows
 *      (another user's notification is untouchable); omitted ids = mark all.
 */
class NotificationsTest extends TestCase
{
    use RefreshDatabase;

    /** Liking someone's post notifies the author exactly once. */
    public function test_liking_a_post_creates_one_notification_for_the_author(): void
    {
        $author = User::factory()->create();
        $liker  = User::factory()->create();
        $post   = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Fluffy focaccia, finally.',
        ]);

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('liked', true);

        $this->assertDatabaseHas('notifications', [
            'user_id'  => $author->id,
            'type'     => 'like',
            'actor_id' => $liker->id,
            'post_id'  => $post->id,
            'read_at'  => null,
        ]);
        // Exactly one row — and nothing in the liker's own inbox.
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());
        $this->assertSame(0, Notification::where('user_id', $liker->id)->count());
    }

    /** Liking your own post never notifies you. */
    public function test_self_like_creates_no_notification(): void
    {
        $author = User::factory()->create();
        $post   = Post::create([
            'user_id' => $author->id,
            'kind'    => 'fail',
            'body'    => 'Sourdough brick.',
        ]);

        $this->actingAs($author, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertOk()
            ->assertJsonPath('liked', true);

        $this->assertSame(0, Notification::count());
    }

    /**
     * Un-liking creates nothing and leaves the old row alone; a re-like
     * after an unlike adds a second row (acceptable v1 behavior).
     */
    public function test_unlike_creates_no_notification_but_relike_does(): void
    {
        $author = User::factory()->create();
        $liker  = User::factory()->create();
        $post   = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Knead less, bake more.',
        ]);

        // Like -> one notification.
        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', true);
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());

        // Unlike -> still one row (nothing created, nothing deleted).
        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', false);
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());

        // Re-like -> a second row (v1 keeps the earlier one).
        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', true);
        $this->assertSame(2, Notification::where('user_id', $author->id)->count());
    }

    /** Commenting notifies the post author once; a self-comment never does. */
    public function test_commenting_notifies_author_once_and_self_comment_never(): void
    {
        $author    = User::factory()->create();
        $commenter = User::factory()->create();
        $post      = Post::create([
            'user_id' => $author->id,
            'kind'    => 'question',
            'body'    => 'Why is my tabbouleh soupy?',
        ]);

        // Someone else's comment -> one 'comment' notification.
        $this->actingAs($commenter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Salt and drain the tomatoes.'])
            ->assertCreated();

        $this->assertSame(1, Notification::where('user_id', $author->id)->count());
        $this->assertDatabaseHas('notifications', [
            'user_id'  => $author->id,
            'type'     => 'comment',
            'actor_id' => $commenter->id,
            'post_id'  => $post->id,
        ]);

        // Author commenting on their own post -> no new notification.
        $this->actingAs($author, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments", ['body' => 'Trying it now!'])
            ->assertCreated();

        $this->assertSame(1, Notification::where('user_id', $author->id)->count());
    }

    /**
     * The inbox: 20/page newest-first, actor + post snippet rows, and
     * meta.unread_count. Unauthenticated calls 401.
     */
    public function test_index_paginates_newest_first_with_unread_count(): void
    {
        $author  = User::factory()->create();
        $post    = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => str_repeat('a', 200), // longer than the 80-char snippet
        ]);

        // 25 notifications: 1 pre-read (oldest) + 24 unread (newest).
        Notification::create([
            'user_id'  => $author->id,
            'type'     => 'like',
            'actor_id' => User::factory()->create()->id,
            'post_id'  => $post->id,
            'read_at'  => now(),
        ]);
        for ($i = 0; $i < 24; $i++) {
            Notification::create([
                'user_id'  => $author->id,
                'type'     => $i % 2 === 0 ? 'like' : 'comment',
                'actor_id' => User::factory()->create()->id,
                'post_id'  => $post->id,
            ]);
        }

        // Guest -> 401.
        $this->getJson('/api/notifications')->assertUnauthorized();

        // Page 1: 20 rows, newest first (highest id = last insert on top).
        $response = $this->actingAs($author, 'sanctum')
            ->getJson('/api/notifications')
            ->assertOk();

        $this->assertCount(20, $response->json('data'));
        $this->assertSame(25, $response->json('data.0.id'));
        $this->assertSame(24, $response->json('meta.unread_count'));
        $this->assertSame(1, $response->json('meta.current_page'));
        $this->assertSame(2, $response->json('meta.last_page'));
        $this->assertSame(25, $response->json('meta.total'));

        // Row shape: actor identity + light post reference with the snippet.
        // data.0 is the newest insert (loop i=23 → 'comment').
        $row = $response->json('data.0');
        $this->assertSame('comment', $row['type']);
        $this->assertNull($row['read_at']);
        $this->assertNotNull($row['created_at']);
        $this->assertNotNull($row['actor']['id']);
        $this->assertArrayHasKey('avatar_url', $row['actor']);
        $this->assertSame($post->id, $row['post']['id']);
        $this->assertSame('try', $row['post']['kind']);
        // Snippet = first 80 chars + ellipsis (Str::limit default).
        $this->assertSame(Str::limit($post->body, 80), $row['post']['body']);
        $this->assertSame(str_repeat('a', 80), mb_substr($row['post']['body'], 0, 80));

        // Page 2: the remaining 5 rows.
        $page2 = $this->actingAs($author, 'sanctum')
            ->getJson('/api/notifications?page=2')
            ->assertOk();
        $this->assertCount(5, $page2->json('data'));
        $this->assertSame(24, $page2->json('meta.unread_count'));
    }

    /**
     * Mark-read is ownership-scoped: another user's notification id is
     * ignored (stays unread), and omitted ids mark the caller's whole inbox.
     */
    public function test_read_marks_only_owned_notifications(): void
    {
        $author    = User::factory()->create();
        $stranger  = User::factory()->create();
        $liker     = User::factory()->create();
        $post      = Post::create([
            'user_id' => $author->id,
            'kind'    => 'try',
            'body'    => 'Crispy shallots.',
        ]);

        $authorNotifs = Notification::create([
            'user_id'  => $author->id,
            'type'     => 'like',
            'actor_id' => $liker->id,
            'post_id'  => $post->id,
        ]);
        $authorNotifs2 = Notification::create([
            'user_id'  => $author->id,
            'type'     => 'comment',
            'actor_id' => $liker->id,
            'post_id'  => $post->id,
        ]);
        $strangerNotif = Notification::create([
            'user_id'  => $stranger->id,
            'type'     => 'like',
            'actor_id' => $liker->id,
            'post_id'  => $post->id,
        ]);

        // Explicit ids INCLUDING the stranger's row: only owned rows flip.
        $this->actingAs($author, 'sanctum')
            ->postJson('/api/notifications/read', [
                'ids' => [$authorNotifs->id, $strangerNotif->id],
            ])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('marked', 1);

        $this->assertNotNull($authorNotifs->fresh()->read_at);
        $this->assertNull($strangerNotif->fresh()->read_at);
        $this->assertNull($authorNotifs2->fresh()->read_at);

        // Omitted ids -> mark ALL of the caller's remaining unread rows.
        $this->actingAs($author, 'sanctum')
            ->postJson('/api/notifications/read')
            ->assertOk()
            ->assertJsonPath('marked', 1);

        $this->assertNotNull($authorNotifs2->fresh()->read_at);
        // The stranger's row is STILL untouched.
        $this->assertNull($strangerNotif->fresh()->read_at);
        $this->assertSame(1, Notification::whereNull('read_at')->count());
    }
}
