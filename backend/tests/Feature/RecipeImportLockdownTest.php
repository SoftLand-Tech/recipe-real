<?php

namespace Tests\Feature;

use App\Jobs\ProcessRecipeImport;
use App\Models\RecipeImport;
use App\Models\User;
use App\Services\RecipeImport\PublicUrlGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class RecipeImportLockdownTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // The controller gate runs AFTER form validation, and validation
        // resolves the source_url host through PublicUrlGuard (live DNS).
        // Bind a no-op guard so the lockdown tests stay hermetic.
        $this->app->bind(PublicUrlGuard::class, fn () => new class
        {
            public function assertPublic(string $url): void {}
        });
    }

    public function test_non_admin_cannot_queue_recipe_imports(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports', [
                'source_url' => 'https://example.com/recipe',
            ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Recipe import is not available yet.');

        $this->assertDatabaseCount('recipe_imports', 0);
        Queue::assertNothingPushed();
    }

    public function test_allowlisted_admin_can_queue_recipe_imports(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        config(['admin.emails' => $user->email]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports', [
                'source_url' => 'https://example.com/recipe',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'queued');

        Queue::assertPushed(ProcessRecipeImport::class);
    }

    public function test_non_admin_cannot_retry_an_import(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $import = RecipeImport::create([
            'requested_by' => $user->id,
            'status' => 'failed',
            'source_kind' => 'url',
            'source_assets' => [],
        ]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports/'.$import->id.'/retry')
            ->assertForbidden();

        Queue::assertNothingPushed();
        $this->assertSame('failed', $import->fresh()->status);
    }

    public function test_agy_skip_permissions_defaults_to_false(): void
    {
        $this->assertSame(
            false,
            config('recipereal.ai.providers.agy.dangerously_skip_permissions'),
        );
    }

    public function test_retry_is_capped_at_three_per_import(): void
    {
        Queue::fake();
        $admin = User::factory()->create();
        config(['admin.emails' => $admin->email]);
        $import = RecipeImport::create([
            'requested_by' => $admin->id,
            'status' => 'failed',
            'source_kind' => 'url',
            'source_assets' => [],
        ]);

        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($admin, 'sanctum')
                ->postJson('/api/recipe-imports/'.$import->id.'/retry')
                ->assertOk();
        }

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/recipe-imports/'.$import->id.'/retry')
            ->assertTooManyRequests()
            ->assertJsonPath('message', 'Too many retries. Create a new import.');
    }
}
