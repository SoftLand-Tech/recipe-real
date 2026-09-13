<?php

namespace Tests\Feature;

use App\Jobs\ProcessRecipeImport;
use App\Models\RecipeImport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RecipeImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_queue_a_social_url_import(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports', [
                'source_url' => 'https://www.tiktok.com/@recipe-real/video/123456789',
                'provider' => 'custom',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.status', 'queued')
            ->assertJsonPath('data.source_platform', 'tiktok')
            ->assertJsonMissingPath('data.source_assets');

        $import = RecipeImport::query()->firstOrFail();
        $this->assertSame($user->id, $import->requested_by);
        $this->assertSame('https://www.tiktok.com/@recipe-real/video/123456789', $import->source_url);

        Queue::assertPushed(ProcessRecipeImport::class, fn (ProcessRecipeImport $job): bool => $job->importId === $import->id);
    }

    public function test_authenticated_user_can_queue_an_uploaded_image_import(): void
    {
        Queue::fake();
        Storage::fake('local');
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'sanctum')
            ->post('/api/recipe-imports', [
                'provider' => 'agy',
                'primary_file' => UploadedFile::fake()->create('recipe.jpg', 10, 'image/jpeg'),
                'extra_images' => [UploadedFile::fake()->create('step.png', 10, 'image/png')],
            ], [
                'Accept' => 'application/json',
            ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.status', 'queued')
            ->assertJsonPath('data.source_kind', 'image')
            ->assertJsonMissingPath('data.source_assets');

        $import = RecipeImport::query()->firstOrFail();
        $this->assertCount(2, $import->source_assets);
        Storage::disk('local')->assertExists($import->source_assets[0]['path']);
        Storage::disk('local')->assertExists($import->source_assets[1]['path']);
        Queue::assertPushed(ProcessRecipeImport::class, fn (ProcessRecipeImport $job): bool => $job->importId === $import->id);
    }

    public function test_create_rejects_a_private_source_url_before_queueing(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports', [
                'source_url' => 'http://127.0.0.1:8080/internal-recipe',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('source_url');

        $this->assertDatabaseCount('recipe_imports', 0);
        Queue::assertNothingPushed();
    }

    public function test_import_drafts_are_private_to_the_requesting_user(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $import = RecipeImport::create([
            'requested_by' => $owner->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_url' => 'https://recipes.example.test/private',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
            'draft' => ['title' => 'Private draft'],
        ]);

        $this->actingAs($stranger, 'sanctum')
            ->getJson('/api/recipe-imports/'.$import->id)
            ->assertNotFound();
    }

    public function test_user_can_list_only_their_own_imports_newest_first(): void
    {
        $owner = User::factory()->create();
        $stranger = User::factory()->create();
        $first = RecipeImport::create([
            'requested_by' => $owner->id,
            'status' => 'failed',
            'source_kind' => 'url',
            'source_url' => 'https://recipes.example.test/old',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'failed',
            'progress' => 100,
        ]);
        $second = RecipeImport::create([
            'requested_by' => $owner->id,
            'status' => 'processing',
            'source_kind' => 'video',
            'source_assets' => [],
            'provider' => 'agy',
            'stage' => 'extracting_recipe',
            'progress' => 35,
        ]);
        RecipeImport::create([
            'requested_by' => $stranger->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_url' => 'https://recipes.example.test/other',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->getJson('/api/recipe-imports')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('data.1.id', $first->id);
    }

    public function test_import_job_normalizes_provider_output_into_a_reviewable_draft(): void
    {
        config()->set('recipereal.ai.providers.custom.protocol', 'generic');
        config()->set('recipereal.ai.providers.custom.endpoint', 'https://ai.test/extract');
        config()->set('recipereal.ai.providers.custom.model', 'recipe-test');
        Storage::fake('local');
        Storage::fake('public');

        Http::fake([
            'https://www.tiktok.com/oembed*' => Http::response([
                'title' => 'TikTok recipe',
                'author_name' => 'Recipe Real',
                'thumbnail_url' => 'https://cdn.test/tiktok.jpg',
            ]),
            'https://ai.test/extract' => Http::response([
                'title' => 'Lemon chicken',
                'description' => 'A quick pan recipe.',
                'servings' => 4,
                'prep_time_minutes' => 10,
                'cook_time_minutes' => 25,
                'total_time_minutes' => 35,
                'ingredients' => [
                    ['raw' => '2 chicken breasts', 'quantity' => 2, 'item' => 'chicken breasts'],
                    ['raw' => '1 lemon', 'quantity' => 1, 'item' => 'lemon'],
                ],
                'steps' => [
                    ['description' => 'Season the chicken.', 'minutes_estimated' => 5],
                    ['description' => 'Cook until done.', 'minutes_estimated' => 25, 'literal_minutes' => 25],
                ],
                'overall_confidence' => 0.92,
            ]),
            '*' => Http::response([], 404),
        ]);

        $import = RecipeImport::create([
            'requested_by' => User::factory()->create()->id,
            'status' => 'queued',
            'source_kind' => 'url',
            'source_platform' => 'tiktok',
            'source_url' => 'https://www.tiktok.com/@recipe-real/video/123456789',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'queued',
            'progress' => 0,
        ]);
        $assetPath = 'recipe-imports/'.$import->id.'/source.jpg';
        Storage::disk('local')->put($assetPath, 'fake image bytes');
        $import->update([
            'source_assets' => [[
                'role' => 'primary',
                'kind' => 'image',
                'disk' => 'local',
                'path' => $assetPath,
                'mime_type' => 'image/jpeg',
                'original_name' => 'source.jpg',
                'size' => 16,
            ]],
        ]);

        ProcessRecipeImport::dispatchSync($import->id);

        $import->refresh();
        $this->assertSame('ready', $import->status);
        $this->assertSame('ready_for_review', $import->stage);
        $this->assertSame(100, $import->progress);
        $this->assertSame('Lemon chicken', data_get($import->draft, 'title'));
        $this->assertSame(2, count(data_get($import->draft, 'ingredients')));
        $this->assertSame(25, data_get($import->draft, 'steps.1.literal_minutes'));
        $this->assertSame(0.92, data_get($import->confidence, 'overall'));
        $this->assertContains('media_resolver_not_configured', $import->warnings);
        Storage::disk('local')->assertMissing($assetPath);

        Http::assertSent(fn ($request): bool => $request->url() === 'https://ai.test/extract'
            && data_get($request->data(), 'source.platform') === 'tiktok'
            && data_get($request->data(), 'source.assets.0.data_base64') !== null);
    }

    public function test_import_job_can_use_the_local_agy_worker_with_staged_assets(): void
    {
        config()->set('recipereal.ai.providers.agy', [
            'driver' => 'agy',
            'command' => [PHP_BINARY, base_path('tests/Fixtures/fake-agy.php')],
            'model' => 'gemini-3.8-flash-high',
            'effort' => 'high',
            'timeout' => 10,
            'print_timeout' => '10s',
            'dangerously_skip_permissions' => true,
            'workspace_root' => sys_get_temp_dir().'/recipereal-test-agy',
            'max_output_bytes' => 1024 * 1024,
        ]);
        Storage::fake('local');
        Storage::fake('public');

        $import = RecipeImport::create([
            'requested_by' => User::factory()->create()->id,
            'status' => 'queued',
            'source_kind' => 'image',
            'source_platform' => null,
            'source_url' => null,
            'source_assets' => [],
            'provider' => 'agy',
            'stage' => 'queued',
            'progress' => 0,
        ]);
        $assetPath = 'recipe-imports/'.$import->id.'/source.jpg';
        Storage::disk('local')->put($assetPath, 'fake image bytes');
        $import->update([
            'source_assets' => [[
                'role' => 'primary',
                'kind' => 'image',
                'disk' => 'local',
                'path' => $assetPath,
                'mime_type' => 'image/jpeg',
                'original_name' => 'source.jpg',
                'size' => 16,
            ]],
        ]);

        ProcessRecipeImport::dispatchSync($import->id);

        $import->refresh();
        $this->assertSame('ready', $import->status);
        $this->assertSame('agy', $import->provider);
        $this->assertSame('gemini-3.8-flash-high', $import->provider_model);
        $this->assertSame('Harness recipe', data_get($import->draft, 'title'));
        $this->assertSame(1, count(data_get($import->draft, 'ingredients')));
        $this->assertSame(5, data_get($import->draft, 'steps.0.minutes_estimated'));
        Storage::disk('local')->assertMissing($assetPath);
        $this->assertSame([], glob(sys_get_temp_dir().'/recipereal-test-agy/*') ?: []);
    }

    public function test_private_source_url_fails_before_any_provider_call(): void
    {
        Http::fake();

        $import = RecipeImport::create([
            'requested_by' => User::factory()->create()->id,
            'status' => 'queued',
            'source_kind' => 'url',
            'source_platform' => 'web',
            'source_url' => 'http://127.0.0.1:8080/internal-recipe',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'queued',
            'progress' => 0,
        ]);

        ProcessRecipeImport::dispatchSync($import->id);

        $import->refresh();
        $this->assertSame('failed', $import->status);
        $this->assertSame('invalid_source_url', $import->error_code);
        Http::assertNothingSent();
    }

    public function test_owner_can_publish_a_reviewed_draft_into_recipe_and_step_tables(): void
    {
        Queue::fake();
        $user = User::factory()->create();
        $import = RecipeImport::create([
            'requested_by' => $user->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_platform' => 'instagram',
            'source_url' => 'https://www.instagram.com/reel/abc123/',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
            'draft' => [
                'title' => 'Draft chicken',
                'cover_image_url' => 'https://cdn.example.test/ai-cover.jpg',
            ],
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->postJson('/api/recipe-imports/'.$import->id.'/publish', [
                'title' => 'Lemon chicken',
                'title_ar' => 'دجاج بالليمون',
                'description' => 'A bright weeknight meal.',
                'source_url' => $import->source_url,
                'image_url' => null,
                'servings' => 4,
                'estimated_minutes' => 35,
                'prep_time_minutes' => 10,
                'cook_time_minutes' => 25,
                'ingredients' => ['2 chicken breasts', '1 lemon'],
                'ingredients_ar' => ['2 صدور دجاج', '1 ليمونة'],
                'ingredients_structured' => [
                    'v' => 1,
                    'items' => [
                        ['raw' => '2 chicken breasts', 'quantity' => 2, 'item' => 'chicken breasts'],
                        ['raw' => '1 lemon', 'quantity' => 1, 'item' => 'lemon'],
                    ],
                ],
                'steps' => [
                    ['description' => 'Season the chicken.', 'minutes_estimated' => 5, 'step_type' => 'active'],
                    ['description' => 'Cook until golden.', 'minutes_estimated' => 25, 'literal_minutes' => 25, 'step_type' => 'passive'],
                ],
                'category' => 'Dinner',
                'keywords' => ['chicken', 'lemon'],
                'calories' => 420,
                'protein_g' => 38,
                'fat_g' => 14,
            ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.title', 'Lemon chicken')
            ->assertJsonPath('data.source_url', $import->source_url);

        $this->assertDatabaseHas('recipes', [
            'owner_id' => $user->id,
            'source_type' => 'user',
            'title' => 'Lemon chicken',
            'image_url' => null,
            'servings' => 4,
            'prep_time_minutes' => 10,
            'cook_time_minutes' => 25,
        ]);

        $recipeId = (int) $response->json('data.id');
        $this->assertDatabaseHas('recipe_steps', [
            'recipe_id' => $recipeId,
            'step_number' => 2,
            'ai_minutes' => 25,
            'literal_minutes' => 25,
        ]);
        $this->assertDatabaseHas('recipe_imports', [
            'id' => $import->id,
            'status' => 'published',
            'recipe_id' => $recipeId,
        ]);
    }

    public function test_admin_can_open_the_import_queue_and_edit_a_ready_draft(): void
    {
        config()->set('admin.emails', 'admin@example.com');
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $import = RecipeImport::create([
            'requested_by' => $admin->id,
            'status' => 'ready',
            'source_kind' => 'url',
            'source_platform' => 'web',
            'source_url' => 'https://recipes.example.test/lemon-chicken',
            'source_assets' => [],
            'provider' => 'custom',
            'stage' => 'ready_for_review',
            'progress' => 100,
            'draft' => [
                'title' => 'Lemon chicken',
                'total_time_minutes' => 35,
                'ingredients' => [['raw' => '2 chicken breasts']],
                'steps' => [['description' => 'Cook the chicken.', 'step_type' => 'active']],
            ],
        ]);

        $this->actingAs($admin, 'web')
            ->get('/admin/recipe-imports')
            ->assertOk()
            ->assertSee('recipes.example.test')
            ->assertSee('New recipe import');

        $this->actingAs($admin, 'web')
            ->get('/admin/recipe-imports/'.$import->id.'/edit')
            ->assertOk()
            ->assertSee('Review extracted recipe');
    }
}
