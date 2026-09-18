<?php

namespace Tests\Feature;

use App\Models\AppInstall;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AppInstallTest extends TestCase
{
    use RefreshDatabase;

    public function test_anonymous_heartbeat_creates_install(): void
    {
        $id = '550e8400-e29b-41d4-a716-446655440000';

        $this->postJson('/api/installs', [
            'install_id' => $id,
            'platform' => 'android',
            'app_version' => '1.0.0',
        ])->assertNoContent();

        $this->assertDatabaseHas('app_installs', [
            'install_id' => $id,
            'platform' => 'android',
            'user_id' => null,
        ]);
    }

    public function test_repeat_heartbeat_updates_last_seen_without_duplicating(): void
    {
        $id = '550e8400-e29b-41d4-a716-446655440001';

        $this->postJson('/api/installs', ['install_id' => $id])->assertNoContent();
        $this->postJson('/api/installs', [
            'install_id' => $id,
            'platform' => 'android',
            'app_version' => '1.0.1',
        ])->assertNoContent();

        $this->assertEquals(1, AppInstall::where('install_id', $id)->count());
        $this->assertEquals('1.0.1', AppInstall::where('install_id', $id)->first()->app_version);
    }

    public function test_authed_heartbeat_links_user_and_anonymous_keeps_link(): void
    {
        $user = User::factory()->create();
        $id = '550e8400-e29b-41d4-a716-446655440002';

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/installs', ['install_id' => $id])
            ->assertNoContent();

        $this->assertEquals($user->id, AppInstall::where('install_id', $id)->first()->user_id);

        // Later anonymous heartbeat must not unlink.
        $this->postJson('/api/installs', ['install_id' => $id])->assertNoContent();

        $this->assertEquals($user->id, AppInstall::where('install_id', $id)->first()->user_id);
    }

    public function test_rejects_invalid_install_id(): void
    {
        $this->postJson('/api/installs', ['install_id' => 'not-a-uuid'])
            ->assertStatus(422);

        $this->assertEquals(0, AppInstall::count());
    }
}
