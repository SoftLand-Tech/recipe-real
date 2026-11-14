<?php

namespace Tests\Feature;

use App\Console\Commands\AuditHalalLibrary;
use App\Models\Recipe;
use App\Models\RecipeStep;
use App\Models\User;
use App\Support\CommunityFeedCache;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers `recipereal:audit-halal`: dry-run HalalGate scanning (pork/alcohol
 * detection + halal vinegar/ginger beer exceptions), user-recipe scoping,
 * machine-readable JSON reporting, and `--apply` deletion + FK cascade +
 * FTS5 search rebuild + timing cache invalidation.
 */
class HalalAuditCommandTest extends TestCase
{
    use RefreshDatabase;

    public function createApplication()
    {
        $worktreeBase = dirname(__DIR__, 2);

        if (! class_exists(AuditHalalLibrary::class)) {
            require_once $worktreeBase.'/app/Console/Commands/AuditHalalLibrary.php';
        }

        // Worktrees that symlink vendor/ to the main checkout cause
        // Application::inferBasePath() and Composer's App\ map to point at
        // the main checkout; scope APP_BASE_PATH to this worktree during boot
        // so Artisan discovers our worktree command in both setups.
        if (Application::inferBasePath() !== $worktreeBase && ! isset($_ENV['APP_BASE_PATH'], $_SERVER['APP_BASE_PATH'])) {
            $_ENV['APP_BASE_PATH'] = $worktreeBase;
            try {
                return parent::createApplication();
            } finally {
                unset($_ENV['APP_BASE_PATH']);
            }
        }

        return parent::createApplication();
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @param  list<array{description: string, description_ar?: ?string, step_type?: string}>  $steps
     */
    private function createRecipe(array $attributes = [], array $steps = []): Recipe
    {
        $stepList = $steps !== [] ? $steps : [
            ['description' => 'Prepare the ingredients carefully.'],
            ['description' => 'Cook thoroughly and serve warm.'],
        ];

        $recipe = Recipe::create(array_merge([
            'title' => 'Test Recipe',
            'source_type' => 'foodcom',
            'ingredients' => ['olive oil', 'garlic'],
            'steps' => array_map(static fn (array $step): string => $step['description'], $stepList),
            'steps_count' => count($stepList),
            'publisher_time_minutes' => 20,
        ], $attributes));

        foreach ($stepList as $index => $step) {
            RecipeStep::create([
                'recipe_id' => $recipe->id,
                'step_number' => $index + 1,
                'description' => $step['description'],
                'description_ar' => $step['description_ar'] ?? null,
                'step_type' => $step['step_type'] ?? 'active',
            ]);
        }

        return $recipe;
    }

    public function test_dry_run_detects_pork_and_alcohol_while_passing_halal_exceptions_without_deleting(): void
    {
        $bacon = $this->createRecipe([
            'title' => 'Crispy Breakfast Plate',
            'ingredients' => ['2 strips bacon', '2 eggs'],
        ]);

        $prosciutto = $this->createRecipe([
            'title' => 'Melon Appetizer',
            'ingredients' => ['4 slices prosciutto', 'cantaloupe'],
        ]);

        $redWine = $this->createRecipe(
            ['title' => 'Braised Beef'],
            [
                ['description' => 'Sear beef in olive oil.'],
                ['description' => 'Deglaze with 1 cup red wine and simmer.'],
            ],
        );

        $bourbon = $this->createRecipe(
            ['title' => 'Glazed Carrots'],
            [
                ['description' => 'Roast carrots until tender.'],
                ['description' => 'Finish with 2 tbsp bourbon glaze.'],
            ],
        );

        $vinegar = $this->createRecipe(
            [
                'title' => 'Mediterranean Salad',
                'ingredients' => ['tomatoes', 'red wine vinegar', 'olive oil'],
            ],
            [
                ['description' => 'Chop tomatoes and cucumbers.'],
                ['description' => 'Whisk olive oil with red wine vinegar and drizzle.'],
            ],
        );

        $gingerBeer = $this->createRecipe(
            [
                'title' => 'Citrus Cooler',
                'ingredients' => ['chilled ginger beer', 'fresh lime'],
            ],
            [
                ['description' => 'Squeeze lime juice over ice.'],
                ['description' => 'Top with ginger beer and mint.'],
            ],
        );

        $normal = $this->createRecipe([
            'title' => 'Herb Chicken Sandwich',
            'ingredients' => ['chicken breast', 'rosemary', 'hamburger buns'],
        ]);

        $this->artisan('recipereal:audit-halal')
            ->expectsOutputToContain('Dry run — pass --apply to delete 4 offending recipe(s).')
            ->assertExitCode(0);

        $this->assertDatabaseCount('recipes', 7);
        $this->assertDatabaseCount('recipe_steps', 14);

        $exitCode = Artisan::call('recipereal:audit-halal', ['--json' => true]);
        $this->assertSame(0, $exitCode);

        $report = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($report['dry_run']);
        $this->assertSame(7, $report['scanned_count']);
        $this->assertSame(4, $report['flagged_count']);
        $this->assertSame(0, $report['deleted_count']);

        $flaggedIds = array_column($report['samples'], 'id');
        $this->assertEqualsCanonicalizing(
            [$bacon->id, $prosciutto->id, $redWine->id, $bourbon->id],
            $flaggedIds,
        );
        $this->assertNotContains($vinegar->id, $flaggedIds);
        $this->assertNotContains($gingerBeer->id, $flaggedIds);
        $this->assertNotContains($normal->id, $flaggedIds);
    }

    public function test_dry_run_reports_clean_library_when_no_offending_recipes_exist(): void
    {
        $this->createRecipe([
            'title' => 'Halal Vinaigrette Greens',
            'ingredients' => ['mixed greens', 'red wine vinegar', 'ginger beer'],
        ]);

        $this->artisan('recipereal:audit-halal')
            ->expectsOutputToContain('0 offending recipes found — library is halal-clean.')
            ->assertExitCode(0);
    }

    public function test_user_created_recipes_are_skipped_by_default_and_scanned_with_include_user(): void
    {
        $user = User::factory()->create();

        $this->createRecipe([
            'title' => 'Imported Lentil Soup',
            'source_type' => 'foodcom',
            'ingredients' => ['red lentils', 'cumin'],
        ]);

        $userOffending = $this->createRecipe([
            'owner_id' => $user->id,
            'source_type' => 'user',
            'title' => 'User Pasta',
            'ingredients' => ['pancetta', 'garlic'],
        ]);

        $exitDefault = Artisan::call('recipereal:audit-halal', ['--json' => true]);
        $this->assertSame(0, $exitDefault);

        $defaultReport = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertFalse($defaultReport['include_user']);
        $this->assertSame(1, $defaultReport['scanned_count']);
        $this->assertSame(0, $defaultReport['flagged_count']);

        // --apply without --include-user must leave user-authored recipes untouched.
        $this->artisan('recipereal:audit-halal', ['--apply' => true])->assertExitCode(0);
        $this->assertDatabaseHas('recipes', ['id' => $userOffending->id]);

        $exitIncluded = Artisan::call('recipereal:audit-halal', [
            '--include-user' => true,
            '--json' => true,
        ]);
        $this->assertSame(0, $exitIncluded);

        $includedReport = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($includedReport['include_user']);
        $this->assertSame(2, $includedReport['scanned_count']);
        $this->assertSame(1, $includedReport['flagged_count']);
        $this->assertSame($userOffending->id, $includedReport['samples'][0]['id']);
        $this->assertSame(['pancetta'], $includedReport['samples'][0]['terms']);
    }

    public function test_json_output_includes_sorted_terms_breakdown_and_caps_samples_at_twenty(): void
    {
        for ($i = 1; $i <= 21; $i++) {
            $this->createRecipe([
                'title' => "Smoky Skillet {$i}",
                'ingredients' => ['bacon', 'potatoes'],
            ]);
        }

        $this->createRecipe([
            'title' => 'Spiced Sauce',
            'description' => 'Simmered gently with bourbon.',
        ]);

        $this->createRecipe(
            [
                'title' => 'Steamed Rice',
                'keywords' => ['dinner', 'quick'],
            ],
            [
                ['description' => 'Prepare the sauce.', 'description_ar' => 'أضف القليل من bourbon للنكهة.'],
                ['description' => 'Serve hot.'],
            ],
        );

        $this->createRecipe([
            'title' => 'Creamy Tomato Sauce',
            'source_type' => 'batch',
            'ingredients_ar' => json_encode(['طماطم', 'vodka', 'كريمة'], JSON_UNESCAPED_UNICODE),
        ]);

        $this->createRecipe([
            'title' => 'Rum Cake',
            'keywords' => ['dessert'],
        ]);

        $this->createRecipe([
            'title' => 'Special Glaze',
            'title_ar' => 'صلصة مع sake ياباني',
        ]);

        $this->createRecipe([
            'title' => 'Quick Dinner',
            'keywords' => ['weeknight', 'chorizo'],
        ]);

        $this->createRecipe([
            'title' => 'Clean Mujadara',
            'ingredients' => ['lentils', 'rice', 'onions'],
        ]);

        $exitCode = Artisan::call('recipereal:audit-halal', ['--json' => true]);
        $this->assertSame(0, $exitCode);

        $report = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($report['dry_run']);
        $this->assertFalse($report['include_user']);
        $this->assertSame(28, $report['scanned_count']);
        $this->assertSame(27, $report['flagged_count']);
        $this->assertSame(0, $report['deleted_count']);
        $this->assertSame(['bacon', 'bourbon', 'chorizo', 'rum', 'sake', 'vodka'], array_keys($report['terms_breakdown']));
        $this->assertSame([
            'bacon' => 21,
            'bourbon' => 2,
            'chorizo' => 1,
            'rum' => 1,
            'sake' => 1,
            'vodka' => 1,
        ], $report['terms_breakdown']);
        $this->assertCount(20, $report['samples']);
        $this->assertArrayHasKey('id', $report['samples'][0]);
        $this->assertArrayHasKey('title', $report['samples'][0]);
        $this->assertArrayHasKey('terms', $report['samples'][0]);
    }

    public function test_apply_deletes_offending_recipes_cascades_steps_rebuilds_fts_and_bumps_cache(): void
    {
        $offendingIngredient = $this->createRecipe([
            'title' => 'Smoky Carbonara Special',
            'ingredients' => ['spaghetti', 'bacon', 'eggs'],
        ]);

        $offendingStep = $this->createRecipe(
            [
                'title' => 'Bourbon Carrots Special',
                'ingredients' => ['carrots', 'butter'],
            ],
            [
                ['description' => 'Roast carrots until tender.'],
                ['description' => 'Deglaze the pan with bourbon.'],
            ],
        );

        $clean = $this->createRecipe([
            'title' => 'Garlic Herb Pasta Special',
            'ingredients' => ['spaghetti', 'garlic', 'olive oil'],
        ]);

        $this->artisan('recipereal:rebuild-search')->assertSuccessful();

        $preSearch = $this->getJson('/api/recipes/search?q=Carbonara')->assertOk();
        $this->assertContains($offendingIngredient->id, collect($preSearch->json('data'))->pluck('id')->all());

        Cache::put('landing:popular', ['cached-cards'], 60);
        $beforeTimingVersion = CommunityFeedCache::timingVersion();

        $exitCode = Artisan::call('recipereal:audit-halal', [
            '--apply' => true,
            '--json' => true,
        ]);
        $this->assertSame(0, $exitCode);

        $report = json_decode(Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertFalse($report['dry_run']);
        $this->assertSame(3, $report['scanned_count']);
        $this->assertSame(2, $report['flagged_count']);
        $this->assertSame(2, $report['deleted_count']);

        $this->assertDatabaseMissing('recipes', ['id' => $offendingIngredient->id]);
        $this->assertDatabaseMissing('recipes', ['id' => $offendingStep->id]);
        $this->assertDatabaseMissing('recipe_steps', ['recipe_id' => $offendingIngredient->id]);
        $this->assertDatabaseMissing('recipe_steps', ['recipe_id' => $offendingStep->id]);

        $this->assertDatabaseHas('recipes', ['id' => $clean->id]);
        $this->assertDatabaseCount('recipes', 1);
        $this->assertDatabaseCount('recipe_steps', 2);

        $this->assertSame(1, (int) DB::selectOne('SELECT COUNT(*) AS c FROM recipes_fts')->c);
        $this->assertSame([], DB::select("SELECT rowid FROM recipes_fts WHERE recipes_fts MATCH 'carbonara'"));
        $this->assertSame([], DB::select("SELECT rowid FROM recipes_fts WHERE recipes_fts MATCH 'bourbon'"));
        $cleanFtsRows = DB::select("SELECT rowid FROM recipes_fts WHERE recipes_fts MATCH 'garlic'");
        $this->assertSame([(int) $clean->id], array_map(static fn ($row): int => (int) $row->rowid, $cleanFtsRows));

        $postDeletedSearch = $this->getJson('/api/recipes/search?q=Carbonara')->assertOk();
        $this->assertNotContains($offendingIngredient->id, collect($postDeletedSearch->json('data'))->pluck('id')->all());

        $postCleanSearch = $this->getJson('/api/recipes/search?q=Garlic')->assertOk();
        $this->assertContains($clean->id, collect($postCleanSearch->json('data'))->pluck('id')->all());

        $this->assertSame($beforeTimingVersion + 1, CommunityFeedCache::timingVersion());
        $this->assertFalse(Cache::has('landing:popular'));
    }

    public function test_apply_human_readable_output_prints_deletion_summary(): void
    {
        $offending = $this->createRecipe([
            'title' => 'Wine Braised Mushrooms',
            'ingredients' => ['mushrooms', 'red wine'],
        ]);

        $this->artisan('recipereal:audit-halal', ['--apply' => true])
            ->expectsOutputToContain('Deleted 1 offending recipe(s), rebuilt FTS search index, and bumped timing cache.')
            ->assertExitCode(0);

        $this->assertDatabaseMissing('recipes', ['id' => $offending->id]);
    }
}
