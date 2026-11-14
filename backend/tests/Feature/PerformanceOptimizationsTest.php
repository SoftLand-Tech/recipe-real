<?php

namespace Tests\Feature;

use App\Jobs\RebuildSearchIndex;
use App\Models\AppInstall;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Models\TimingSubmission;
use App\Models\User;
use App\Support\CommunityFeedCache;
use App\Support\TypesenseSearch;
use Illuminate\Contracts\Queue\ShouldBeUniqueUntilProcessing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PerformanceOptimizationsTest extends TestCase
{
    use RefreshDatabase;

    private function createQualityRecipe(array $overrides = []): Recipe
    {
        $recipe = Recipe::create(array_merge([
            'title' => 'Quality Roasted Chicken',
            'title_ar' => 'دجاج مشوي',
            'source_type' => 'foodcom',
            'image_url' => 'https://example.com/chicken.jpg',
            'ingredients' => ['chicken', 'garlic'],
            'steps' => ['Season chicken.', 'Roast until golden.'],
            'steps_count' => 2,
            'aggregated_rating' => 4.8,
            'review_count' => 30,
            'category' => 'Main Dish',
            'publisher_time_minutes' => 25,
            'dish_count' => 2,
            'grease_level' => 'medium',
            'dishwasher_safe' => true,
        ], $overrides));

        RecipeStep::create([
            'recipe_id' => $recipe->id,
            'step_number' => 1,
            'description' => 'Season chicken.',
            'description_ar' => 'تبّل الدجاج.',
            'step_type' => 'active',
            'publisher_minutes' => 5,
            'ai_minutes' => 5,
        ]);

        RecipeStep::create([
            'recipe_id' => $recipe->id,
            'step_number' => 2,
            'description' => 'Roast for 20 minutes.',
            'description_ar' => 'اشوِه لمدة 20 دقيقة.',
            'step_type' => 'passive',
            'publisher_minutes' => 20,
            'ai_minutes' => 25,
            'literal_minutes' => 20,
        ]);

        return $recipe;
    }

    public function test_post_latest_comment_eager_load_uses_one_per_post_query(): void
    {
        $author = User::factory()->create();
        $commenter = User::factory()->create();

        $postA = Post::create(['user_id' => $author->id, 'body' => 'Post A']);
        $postB = Post::create(['user_id' => $author->id, 'body' => 'Post B']);

        foreach (range(1, 5) as $i) {
            PostComment::create([
                'post_id' => $postA->id,
                'user_id' => $commenter->id,
                'body' => "A comment {$i}",
            ]);
            PostComment::create([
                'post_id' => $postB->id,
                'user_id' => $commenter->id,
                'body' => "B comment {$i}",
            ]);
        }

        DB::flushQueryLog();
        DB::enableQueryLog();

        $posts = Post::query()->with('latestComment')->orderBy('id')->get();
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $commentQuery = collect($queries)->first(
            fn (array $q) => str_contains($q['query'], 'post_comments')
        );

        $this->assertNotNull($commentQuery);
        $this->assertStringContainsString('max(', strtolower($commentQuery['query']));
        $this->assertSame('A comment 5', $posts[0]->latestComment?->body);
        $this->assertSame('B comment 5', $posts[1]->latestComment?->body);
    }

    public function test_home_returns_etag_cache_control_304_and_preserves_payload_across_cache_hits(): void
    {
        $this->createQualityRecipe();

        $first = $this->getJson('/api/home')->assertOk();
        $etag = $first->headers->get('ETag');
        $cacheControl = (string) $first->headers->get('Cache-Control');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=60', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=300', $cacheControl);

        // Cache hit returns identical JSON payload.
        $second = $this->getJson('/api/home')->assertOk();
        $this->assertSame($first->json(), $second->json());

        // Conditional request with matching ETag returns 304 Not Modified.
        $this->get('/api/home', ['If-None-Match' => $etag])->assertStatus(304);

        // Timing bump changes the ETag so stale conditional requests get 200.
        CommunityFeedCache::bumpTiming();
        $afterBump = $this->get('/api/home', ['If-None-Match' => $etag])->assertOk();
        $this->assertNotSame($etag, $afterBump->headers->get('ETag'));
    }

    public function test_reality_returns_etag_cache_control_304_and_preserves_payload_across_cache_hits(): void
    {
        $this->createQualityRecipe([
            'reality_minutes' => 60,
            'reality_source' => 'community',
            'reality_samples' => 5,
        ]);

        $first = $this->getJson('/api/reality?mode=under&take=5')->assertOk();
        $etag = $first->headers->get('ETag');
        $cacheControl = (string) $first->headers->get('Cache-Control');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=60', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=300', $cacheControl);
        $this->assertCount(1, $first->json('data'));

        $second = $this->getJson('/api/reality?mode=under&take=5')->assertOk();
        $this->assertSame($first->json(), $second->json());

        $this->get('/api/reality?mode=under&take=5', ['If-None-Match' => $etag])->assertStatus(304);
    }

    public function test_categories_returns_etag_cache_control_and_304(): void
    {
        $this->createQualityRecipe(['category' => 'Breakfast']);

        $first = $this->getJson('/api/recipes/categories')->assertOk();
        $etag = $first->headers->get('ETag');
        $cacheControl = (string) $first->headers->get('Cache-Control');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=300', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=600', $cacheControl);

        $this->get('/api/recipes/categories', ['If-None-Match' => $etag])->assertStatus(304);
    }

    public function test_paged_seed_caches_resolved_payload_and_returns_etag_and_304(): void
    {
        $this->createQualityRecipe();

        $first = $this->getJson('/api/recipes/seed?page=1&per_page=10')->assertOk();
        $etag = $first->headers->get('ETag');
        $cacheControl = (string) $first->headers->get('Cache-Control');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=60', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=300', $cacheControl);
        $this->assertSame(30, $first->json('data.0.time.time_total_minutes'));
        $this->assertSame('20.00', $first->json('data.0.recipe_steps.1.literal_minutes'));

        $second = $this->getJson('/api/recipes/seed?page=1&per_page=10')->assertOk();
        $this->assertSame($first->json(), $second->json());

        $this->get('/api/recipes/seed?page=1&per_page=10', ['If-None-Match' => $etag])->assertStatus(304);
    }

    public function test_unfiltered_search_returns_etag_cache_control_304_and_invalidates_etag_on_payload_change(): void
    {
        $this->createQualityRecipe(['title' => 'First Quality Recipe']);

        $first = $this->getJson('/api/recipes/search')->assertOk();
        $etag = $first->headers->get('ETag');
        $cacheControl = (string) $first->headers->get('Cache-Control');

        $this->assertNotEmpty($etag);
        $this->assertStringContainsString('public', $cacheControl);
        $this->assertStringContainsString('max-age=60', $cacheControl);
        $this->assertStringContainsString('stale-while-revalidate=300', $cacheControl);

        // Cache hit returns identical JSON payload and matching ETag.
        $second = $this->getJson('/api/recipes/search')->assertOk();
        $this->assertSame($first->json(), $second->json());
        $this->assertSame($etag, $second->headers->get('ETag'));

        // Conditional request with matching ETag returns 304 Not Modified.
        $this->get('/api/recipes/search', ['If-None-Match' => $etag])->assertStatus(304);

        // Invalidate cache and add another recipe to change payload.
        Cache::flush();
        $this->createQualityRecipe(['title' => 'Second Quality Recipe']);

        $third = $this->getJson('/api/recipes/search')->assertOk();
        $newEtag = $third->headers->get('ETag');
        $this->assertNotEmpty($newEtag);
        $this->assertNotSame($etag, $newEtag);

        // Stale ETag returns 200, fresh ETag returns 304.
        $this->get('/api/recipes/search', ['If-None-Match' => $etag])->assertOk();
        $this->get('/api/recipes/search', ['If-None-Match' => $newEtag])->assertStatus(304);
    }

    public function test_show_caches_payload_across_hits_and_records_views_for_authed_users(): void
    {
        $recipe = $this->createQualityRecipe();
        $user = User::factory()->create();

        // Warm cache as guest.
        $guestResponse = $this->getJson("/api/recipes/{$recipe->id}")->assertOk();

        // Cache hit as signed-in user must return identical JSON and record view.
        $authedResponse = $this->actingAs($user, 'sanctum')
            ->getJson("/api/recipes/{$recipe->id}")
            ->assertOk();

        $this->assertSame($guestResponse->json(), $authedResponse->json());
        $this->assertDatabaseHas('recipe_views', [
            'user_id' => $user->id,
            'recipe_id' => $recipe->id,
            'month_key' => now()->format('Y-m'),
        ]);
    }

    public function test_index_and_search_cache_unfiltered_page_one_and_preserve_payload(): void
    {
        $this->createQualityRecipe();

        $indexFirst = $this->getJson('/api/recipes')->assertOk();
        $indexSecond = $this->getJson('/api/recipes')->assertOk();
        $this->assertSame($indexFirst->json(), $indexSecond->json());
        $this->assertCount(1, $indexFirst->json('data'));

        $searchFirst = $this->getJson('/api/recipes/search')->assertOk();
        $searchSecond = $this->getJson('/api/recipes/search')->assertOk();
        $this->assertSame($searchFirst->json(), $searchSecond->json());
        $this->assertCount(1, $searchFirst->json('data'));
    }

    public function test_quick_time_skips_step_recomputation(): void
    {
        $user = User::factory()->create();
        $recipe = $this->createQualityRecipe();
        $step = $recipe->recipeSteps()->firstOrFail();

        // Seed a submission and an intentionally distinct step average to confirm
        // quick-time passes $recomputeSteps = false and does not scan/update steps.
        TimingSubmission::create([
            'user_id' => $user->id,
            'recipe_step_id' => $step->id,
            'actual_minutes' => 10,
            'session_id' => (string) Str::uuid(),
        ]);
        $step->update(['community_avg_minutes' => 99.00]);

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/recipes/{$recipe->id}/quick-time", ['minutes' => 45])
            ->assertStatus(201);

        $recipe->refresh();
        $step->refresh();

        $this->assertEquals(45.0, (float) $recipe->community_avg_minutes);
        $this->assertSame('community', $recipe->reality_source);
        $this->assertEquals(99.0, (float) $step->community_avg_minutes);
    }

    public function test_app_install_skips_redundant_write_within_one_hour(): void
    {
        $id = '550e8400-e29b-41d4-a716-446655440099';

        $this->postJson('/api/installs', [
            'install_id' => $id,
            'platform' => 'android',
            'app_version' => '1.2.0',
        ])->assertNoContent();

        $tenMinutesAgo = now()->subMinutes(10)->startOfSecond();
        AppInstall::where('install_id', $id)->update(['updated_at' => $tenMinutesAgo]);

        $this->postJson('/api/installs', [
            'install_id' => $id,
            'platform' => 'android',
            'app_version' => '1.2.0',
        ])->assertNoContent();

        $this->assertTrue(
            AppInstall::where('install_id', $id)->firstOrFail()->updated_at->equalTo($tenMinutesAgo)
        );

        $overAnHourAgo = now()->subMinutes(65)->startOfSecond();
        AppInstall::where('install_id', $id)->update(['updated_at' => $overAnHourAgo]);

        $this->postJson('/api/installs', [
            'install_id' => $id,
            'platform' => 'android',
            'app_version' => '1.2.0',
        ])->assertNoContent();

        $this->assertTrue(
            AppInstall::where('install_id', $id)->firstOrFail()->updated_at->gt($overAnHourAgo)
        );
    }

    public function test_rebuild_search_index_job_is_unique(): void
    {
        $job = new RebuildSearchIndex;

        $this->assertInstanceOf(ShouldBeUniqueUntilProcessing::class, $job);
        $this->assertSame(120, $job->uniqueFor);

        $middleware = $job->middleware();
        $this->assertCount(1, $middleware);
        $this->assertInstanceOf(WithoutOverlapping::class, $middleware[0]);
    }

    public function test_search_cache_key_distinguishes_default_sort_and_top_rated_sort(): void
    {
        $first = $this->createQualityRecipe(['title' => 'Alpha Dish']);
        $second = $this->createQualityRecipe(['title' => 'Beta Dish', 'aggregated_rating' => 4.2]);

        $fake = new class($first, $second) extends TypesenseSearch
        {
            /** @var list<string> */
            public array $capturedSorts = [];

            public function __construct(private Recipe $first, private Recipe $second) {}

            public function enabled(): bool
            {
                return true;
            }

            public function searchRecipes(
                string $q,
                string $category = '',
                ?int $timeMax = null,
                string $sort = '',
                int $page = 1,
                int $perPage = 20
            ): ?LengthAwarePaginator {
                $this->capturedSorts[] = $sort;
                $items = $sort === 'top_rated' ? [$this->second, $this->first] : [$this->first, $this->second];

                return new LengthAwarePaginator($items, 2, $perPage, $page);
            }
        };

        $this->app->instance(TypesenseSearch::class, $fake);

        $defaultRes = $this->getJson('/api/recipes/search?per_page=10')->assertOk();
        $topRatedRes = $this->getJson('/api/recipes/search?per_page=10&sort=top_rated')->assertOk();

        $this->assertSame($first->id, $defaultRes->json('data.0.id'));
        $this->assertSame($second->id, $topRatedRes->json('data.0.id'));
        $this->assertSame(['', 'top_rated'], $fake->capturedSorts);
    }

    public function test_seed_and_home_etags_change_when_payload_changes_after_cache_clear(): void
    {
        $this->createQualityRecipe(['title' => 'First Dish', 'review_count' => 25]);

        $homeBefore = $this->getJson('/api/home')->assertOk();
        $seedBefore = $this->getJson('/api/recipes/seed?page=1&per_page=10')->assertOk();
        $homeEtagBefore = $homeBefore->headers->get('ETag');
        $seedEtagBefore = $seedBefore->headers->get('ETag');

        $this->createQualityRecipe(['title' => 'Second Dish', 'review_count' => 25]);
        Cache::flush();

        $homeAfter = $this->getJson('/api/home', ['If-None-Match' => $homeEtagBefore])->assertOk();
        $seedAfter = $this->getJson('/api/recipes/seed?page=1&per_page=10', ['If-None-Match' => $seedEtagBefore])->assertOk();

        $this->assertNotSame($homeEtagBefore, $homeAfter->headers->get('ETag'));
        $this->assertNotSame($seedEtagBefore, $seedAfter->headers->get('ETag'));
    }

    public function test_performance_indexes_migration_rolls_back_and_reapplies_cleanly(): void
    {
        $migration = require database_path('migrations/2026_11_13_000001_add_performance_indexes.php');

        $migration->down();
        $migration->up();

        $this->addToAssertionCount(1);
    }
}
