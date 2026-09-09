<?php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Filament admin surfaces render for allowlisted admins: the combined
 * Reports page (both queue tabs), the renamed Comments/Blocks resources and
 * the Posts/Users upgrades. Guests are redirected to the panel login.
 */
class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        config()->set('admin.emails', 'admin@example.com');

        return User::factory()->create(['email' => 'admin@example.com']);
    }

    public function test_guest_is_redirected_to_panel_login(): void
    {
        $this->get('/admin/reports')->assertRedirect('/admin/login');
        $this->get('/admin/posts')->assertRedirect('/admin/login');
        $this->get('/admin/comments')->assertRedirect('/admin/login');
        $this->get('/admin/blocks')->assertRedirect('/admin/login');
    }

    public function test_reports_page_renders_with_both_queues(): void
    {
        $author = User::factory()->create();
        $reporter = $this->admin();
        $post = Post::create(['user_id' => $author->id, 'body' => 'Flagged post.']);

        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/posts/{$post->id}/report", ['reason' => 'spam'])
            ->assertStatus(201);

        $this->actingAs($reporter, 'web')
            ->get('/admin/reports')
            ->assertOk()
            ->assertSee('Post reports (1)')
            ->assertSee('Comment reports (0)')
            ->assertSeeLivewire('post-reports-table')
            ->assertSeeLivewire('comment-reports-table');
    }

    public function test_renamed_resources_render(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'web')
            ->get('/admin/comments')
            ->assertOk();

        $this->actingAs($admin, 'web')
            ->get('/admin/blocks')
            ->assertOk();

        $this->actingAs($admin, 'web')
            ->get('/admin/users')
            ->assertOk();
    }
}
