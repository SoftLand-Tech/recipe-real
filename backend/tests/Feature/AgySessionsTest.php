<?php

namespace Tests\Feature;

use App\Models\RecipeImport;
use App\Models\User;
use App\Support\AgyProcessInspector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AgySessionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_open_the_agy_sessions_page_first_in_nav(): void
    {
        config()->set('admin.emails', 'admin@example.com');
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        RecipeImport::create([
            'requested_by' => $admin->id,
            'status' => 'processing',
            'source_kind' => 'video',
            'source_assets' => [],
            'provider' => 'agy',
            'stage' => 'extracting_recipe',
            'progress' => 35,
        ]);

        $this->actingAs($admin, 'web')
            ->get('/admin/agy-sessions')
            ->assertOk()
            ->assertSee('In-flight agy imports')
            ->assertSee('OS worker processes')
            ->assertSee('wire:poll', false);
    }

    public function test_inspector_parses_only_recipe_workers_and_never_throws(): void
    {
        $inspector = new AgyProcessInspector();

        $rows = $inspector->parse(
            "  PID     ELAPSED %CPU %MEM COMMAND\n".
            " 1234   02:15    9.9  2.1 /home/u/bin/agy --print Read recipe-instructions.txt and recipe-source.json in the current workspace. --json-schema /tmp/recipereal-ai-imports/01ABC/recipe-schema.json --model x\n".
            " 9999   00:01    0.0  0.1 php artisan queue:work\n",
        );

        $this->assertCount(1, $rows);
        $this->assertSame(1234, $rows[0]['pid']);
        $this->assertSame('/tmp/recipereal-ai-imports/01ABC', $rows[0]['workspace']);
        $this->assertNull($rows[0]['import_id']);

        // Garbage in, empty out — never an exception.
        $this->assertSame([], $inspector->parse('not ps output at all'));
        $this->assertSame([], $inspector->parse(''));
    }

    public function test_topbar_badge_shows_live_agy_count(): void
    {
        config()->set('admin.emails', 'admin@example.com');
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        RecipeImport::create([
            'requested_by' => $admin->id,
            'status' => 'processing',
            'source_kind' => 'video',
            'source_assets' => [],
            'provider' => 'agy',
            'stage' => 'extracting_recipe',
            'progress' => 35,
        ]);

        \Livewire\Livewire::test(\App\Livewire\AgySessionsBadge::class)
            ->assertSee('Agy')
            ->assertSee('<span class="rr-agy-count">1</span>', false);

        // And the badge renders inside the admin topbar.
        $this->actingAs($admin, 'web')
            ->get('/admin')
            ->assertOk()
            ->assertSee('Agy', false);
    }
}
