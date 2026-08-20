<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers content ownership + moderation for the community:
 *
 *   1. Only the author can edit/delete a post or comment (others get 403).
 *   2. Author edits bump `edited` to true; deletes remove the post from the
 *      feed and 404 on detail.
 *   3. Reporting a post/comment twice is idempotent (one row, 201 {ok:true}
 *      both times).
 *   4. Blocking an author removes their posts from the blocker's feed, their
 *      comments from the thread, and 404s their post detail for the blocker
 *      (the author and everyone else still see everything). Unblocking
 *      restores visibility.
 */
class CommunityModerationTest extends TestCase
{
    use RefreshDatabase;

    // ---- Ownership: posts --------------------------------------------------

    /** A non-author gets a JSON 403 on PATCH and DELETE /posts/{post}. */
    public function test_non_author_cannot_edit_or_delete_post(): void
    {
        $author = User::factory()->create();
        $other  = User::factory()->create();
        $post   = Post::create([
            'user_id' => $author->id,
            'body'    => 'Nailed the flatbread.',
        ]);

        $this->actingAs($other, 'sanctum')
            ->patchJson("/api/posts/{$post->id}", ['body' => 'hijacked'])
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not own this post.');

        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/posts/{$post->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('posts', ['id' => $post->id]);
    }

    /** The author edits the body (edited flag flips) and deletes the post. */
    public function test_author_edits_and_deletes_own_post(): void
    {
        $user = User::factory()->create();
        $post = Post::create([
            'user_id' => $user->id,
            'body'    => 'Burnt the rice.',
        ]);

        // Freshly created post is not marked edited.
        $this->getJson("/api/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('data.edited', false);

        // Timestamps are second-granular in sqlite — jump past the created
        // second so the edit is always distinguishable.
        $this->travel(2)->seconds();

        // Author edit: same body shape, new text, edited: true.
        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/posts/{$post->id}", ['body' => 'Burnt the rice, but salvaged a congee.']);
        $response->assertOk();
        $this->assertSame('Burnt the rice, but salvaged a congee.', $response->json('data.body'));
        $this->assertTrue((bool) $response->json('data.edited'));

        // Edit must still pass the halal gate.
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/posts/{$post->id}", ['body' => 'Added a splash of white wine.'])
            ->assertStatus(422);

        // Author delete: 204, gone from the feed and 404 on detail.
        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/posts/{$post->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
        $this->getJson('/api/posts')->assertOk()
            ->assertJsonCount(0, 'data');
        $this->getJson("/api/posts/{$post->id}")->assertNotFound();
    }

    // ---- Ownership: comments -------------------------------------------------

    /** A non-author gets a JSON 403 on PATCH and DELETE of someone's comment. */
    public function test_non_author_cannot_edit_or_delete_comment(): void
    {
        $author  = User::factory()->create();
        $other   = User::factory()->create();
        $post    = Post::create([
            'user_id' => $author->id,
            'body'    => 'Great shakshuka.',
        ]);
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $author->id,
            'body'    => 'Thanks for the tip!',
        ]);

        $this->actingAs($other, 'sanctum')
            ->patchJson("/api/posts/{$post->id}/comments/{$comment->id}", ['body' => 'hijacked'])
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not own this comment.');

        $this->actingAs($other, 'sanctum')
            ->deleteJson("/api/posts/{$post->id}/comments/{$comment->id}")
            ->assertStatus(403);

        $this->assertDatabaseHas('post_comments', ['id' => $comment->id]);
    }

    /** The author edits a comment (edited flag) and deletes it. */
    public function test_author_edits_and_deletes_own_comment(): void
    {
        $user    = User::factory()->create();
        $post    = Post::create([
            'user_id' => $user->id,
            'body'    => 'How long to soak the beans?',
        ]);
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $user->id,
            'body'    => 'Overnight usually.',
        ]);

        // Timestamps are second-granular in sqlite — jump past the created
        // second so the edit is always distinguishable.
        $this->travel(2)->seconds();

        $response = $this->actingAs($user, 'sanctum')
            ->patchJson("/api/posts/{$post->id}/comments/{$comment->id}", [
                'body' => 'Overnight, or 2h in hot water.',
            ]);
        $response->assertOk();
        $this->assertSame('Overnight, or 2h in hot water.', $response->json('data.body'));
        $this->assertTrue((bool) $response->json('data.edited'));

        // Halal gate still applies to edits.
        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/posts/{$post->id}/comments/{$comment->id}", ['body' => 'Simmer it in beer.'])
            ->assertStatus(422);

        $this->actingAs($user, 'sanctum')
            ->deleteJson("/api/posts/{$post->id}/comments/{$comment->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('post_comments', ['id' => $comment->id]);
    }

    /** A comment id from a different post 404s (path scoping). */
    public function test_comment_from_another_post_is_not_found(): void
    {
        $user    = User::factory()->create();
        $postA   = Post::create(['user_id' => $user->id, 'kind' => 'try', 'body' => 'A']);
        $postB   = Post::create(['user_id' => $user->id, 'kind' => 'try', 'body' => 'B']);
        $comment = PostComment::create([
            'post_id' => $postB->id,
            'user_id' => $user->id,
            'body'    => 'lives under B',
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson("/api/posts/{$postA->id}/comments/{$comment->id}", ['body' => 'x'])
            ->assertNotFound();
    }

    // ---- Reports ---------------------------------------------------------------

    /** Reporting a post twice answers 201 {ok:true} both times, one row. */
    public function test_reporting_post_twice_creates_a_single_row(): void
    {
        $author = User::factory()->create();
        $reporter = User::factory()->create();
        $post   = Post::create([
            'user_id' => $author->id,
            'body'    => 'Spammy vibes.',
        ]);

        foreach ([1, 2] as $i) {
            $this->actingAs($reporter, 'sanctum')
                ->postJson("/api/posts/{$post->id}/report", ['reason' => 'spam'])
                ->assertStatus(201)
                ->assertJsonPath('ok', true);
        }

        $this->assertDatabaseCount('post_reports', 1);
        $this->assertDatabaseHas('post_reports', [
            'post_id' => $post->id,
            'user_id' => $reporter->id,
            'reason'  => 'spam',
        ]);
    }

    /** Reporting a comment twice answers 201 {ok:true} both times, one row. */
    public function test_reporting_comment_twice_creates_a_single_row(): void
    {
        $author   = User::factory()->create();
        $reporter = User::factory()->create();
        $post     = Post::create([
            'user_id' => $author->id,
            'body'    => 'Post body.',
        ]);
        $comment  = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $author->id,
            'body'    => 'Rude comment.',
        ]);

        $first = $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments/{$comment->id}/report");
        $first->assertStatus(201)->assertJsonPath('ok', true);

        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/comments/{$comment->id}/report")
            ->assertStatus(201)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseCount('comment_reports', 1);
    }

    // ---- Blocks ----------------------------------------------------------------

    /** The blocker's feed hides the blocked author's posts; unblock restores. */
    public function test_blocker_feed_hides_blocked_author_posts(): void
    {
        $author  = User::factory()->create();
        $blocker = User::factory()->create();
        $bystander = User::factory()->create();
        $blockedPost = Post::create([
            'user_id' => $author->id,
            'body'    => 'Blocked author post.',
        ]);
        $otherPost = Post::create([
            'user_id' => $bystander->id,
            'body'    => 'Bystander post.',
        ]);

        // Block: idempotent 201 {ok:true}.
        $this->actingAs($blocker, 'sanctum')
            ->postJson("/api/users/{$author->id}/block")
            ->assertStatus(201)
            ->assertJsonPath('ok', true);
        $this->actingAs($blocker, 'sanctum')
            ->postJson("/api/users/{$author->id}/block")
            ->assertStatus(201);
        $this->assertDatabaseCount('user_blocks', 1);

        // Index: only the bystander's post remains for the blocker.
        $feed = $this->actingAs($blocker, 'sanctum')->getJson('/api/posts');
        $feed->assertOk();
        $ids = collect($feed->json('data'))->pluck('id')->all();
        $this->assertSame([$otherPost->id], $ids);

        // Detail of the blocked author's post: 404 for the blocker, still
        // 200 for the author (actingAs is sticky per test — order matters).
        $this->actingAs($blocker, 'sanctum')
            ->getJson("/api/posts/{$blockedPost->id}")
            ->assertNotFound();
        $this->actingAs($author, 'sanctum')
            ->getJson("/api/posts/{$blockedPost->id}")
            ->assertOk();

        // Unblock: 204, post visible to the blocker again.
        $this->actingAs($blocker, 'sanctum')
            ->deleteJson("/api/users/{$author->id}/block")
            ->assertNoContent();
        $this->assertDatabaseCount('user_blocks', 0);

        $feed = $this->actingAs($blocker, 'sanctum')->getJson('/api/posts');
        $ids = collect($feed->json('data'))->pluck('id')->all();
        $this->assertContains($blockedPost->id, $ids);
        $this->assertContains($otherPost->id, $ids);
    }

    /** The blocker's comment thread hides the blocked author's comments. */
    public function test_blocker_thread_hides_blocked_author_comments(): void
    {
        $author  = User::factory()->create();
        $blocker = User::factory()->create();
        $friend  = User::factory()->create();
        $post    = Post::create([
            'user_id' => $blocker->id,
            'body'    => 'Best pan for dosa?',
        ]);
        $hiddenComment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $author->id,
            'body'    => 'Blocked author comment.',
        ]);
        $visibleComment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $friend->id,
            'body'    => 'Cast iron.',
        ]);

        $this->actingAs($blocker, 'sanctum')
            ->postJson("/api/users/{$author->id}/block")
            ->assertStatus(201);

        // Bystander (and signed-out readers) see both comments.
        $bystanderIds = collect(
            $this->actingAs($friend, 'sanctum')
                ->getJson("/api/posts/{$post->id}/comments")
                ->assertOk()
                ->json('data')
        )->pluck('id')->all();
        $this->assertContains($hiddenComment->id, $bystanderIds);
        $this->assertContains($visibleComment->id, $bystanderIds);

        // Blocker sees only the friend's comment.
        $ids = collect(
            $this->actingAs($blocker, 'sanctum')
                ->getJson("/api/posts/{$post->id}/comments")
                ->assertOk()
                ->json('data')
        )->pluck('id')->all();
        $this->assertSame([$visibleComment->id], $ids);
    }

    /** Blocking yourself is rejected with 422. */
    public function test_cannot_block_yourself(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/users/{$user->id}/block")
            ->assertStatus(422);

        $this->assertDatabaseCount('user_blocks', 0);
    }
}
