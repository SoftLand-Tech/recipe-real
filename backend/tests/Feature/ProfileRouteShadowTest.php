<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Regression for the "profile broken in the build" incident: the public
 * /users/{user}/profile wildcard matched the literal "me" and shadowed the
 * authed /users/me/profile route (404 "No user 'me'" → the app's profile
 * screen showed its error state). All user wildcards are whereNumber now —
 * "me" must fall through to the exact routes.
 */
class ProfileRouteShadowTest extends TestCase
{
    use RefreshDatabase;

    public function test_me_profile_is_not_shadowed_by_the_public_wildcard(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/users/me/profile')
            ->assertOk()
            ->assertJsonPath('id', $user->id);
    }

    public function test_public_profile_still_resolves_numeric_ids(): void
    {
        $user = User::factory()->create(['display_name' => 'Sara']);

        $this->getJson("/api/users/{$user->id}/profile")
            ->assertOk()
            ->assertJsonPath('display_name', 'Sara');
    }
}
