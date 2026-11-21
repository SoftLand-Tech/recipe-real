<?php

namespace Tests\Feature\RecipeDedup;

use App\Jobs\ProcessRecipeGenerationBatch;
use App\Models\Recipe;
use App\Models\RecipeGenerationBatch;
use App\Models\RecipeGenerationBatchItem;
use App\Models\User;
use App\Services\RecipeDedup\AiJudgeException;
use App\Services\RecipeDedup\Contracts\AiDuplicateJudge;
use App\Services\RecipeDedup\Contracts\EmbeddingProvider;
use App\Services\RecipeDedup\Contracts\RecipeCandidateGenerator;
use App\Services\RecipeDedup\Contracts\VectorStore;
use App\Services\RecipeDedup\Data\CandidateRecipe;
use App\Services\RecipeDedup\Data\GenerationRequest;
use App\Services\RecipeDedup\Detection\DuplicateDetectionService;
use App\Services\RecipeDedup\Fingerprinting\FingerprintService;
use App\Services\RecipeDedup\Generation\BatchGenerationService;
use App\Services\RecipeDedup\GenerationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Support\FakeAiDuplicateJudge;
use Tests\Support\FakeEmbeddingProvider;
use Tests\Support\FakeVectorStore;
use Tests\Support\RecipeFixtures;
use Tests\TestCase;

class BatchGenerationTest extends TestCase
{
    use RefreshDatabase;

    /** Not typed: the scripted generator is an anonymous class. */
    private $generator;

    private FakeAiDuplicateJudge $judge;

    protected function setUp(): void
    {
        parent::setUp();

        // Slice-4 (Detection, merges before this branch) provides the
        // engine this slice drives. Until that merge lands in the tree the
        // batch flows cannot resolve — skip rather than hard-fail.
        if (! class_exists(DuplicateDetectionService::class)) {
            $this->markTestSkipped('Slice 4 (DuplicateDetectionService/RecipeRegistrar) is not merged yet.');
        }

        // The batch flows never touch the provider network: semantic layer
        // off, vector store off, the judge behind the deterministic fake.
        config([
            'recipe_dedup.vector.driver' => 'none',
            'recipe_dedup.embeddings.enabled' => false,
        ]);
        $this->instance(EmbeddingProvider::class, new FakeEmbeddingProvider);
        $this->instance(VectorStore::class, new FakeVectorStore);

        $this->judge = new FakeAiDuplicateJudge;
        $this->instance(AiDuplicateJudge::class, $this->judge);
    }

    public function test_batch_reaches_the_target_with_distinct_recipes(): void
    {
        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::chickenAlfredoClassic()],
            fn (): array => [RecipeFixtures::foulMedames()],
            fn (): array => [RecipeFixtures::shakshukaCaftan()],
        ]);

        $batch = $this->batch(3, ['brief' => 'Weekly dinner rotation', 'batch_size' => 1]);

        $result = app(BatchGenerationService::class)->run($batch);

        $batch = $batch->refresh();
        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $batch->status);
        $this->assertSame(3, $batch->accepted_count);
        $this->assertSame(0, $batch->rejected_count);
        $this->assertSame(0, $batch->failed_count);
        $this->assertSame(3, $batch->generation_attempts);
        $this->assertSame(3, Recipe::query()->count());
        $this->assertNull($batch->error);
        $this->assertNotNull($batch->finished_at);

        $items = $batch->items()->orderBy('id')->get();
        $this->assertCount(3, $items);

        foreach ($items as $item) {
            $this->assertSame(RecipeGenerationBatchItem::ACTION_ACCEPTED, $item->action);
            $this->assertNotNull($item->recipe_id); // registrar inserted + returned
            $this->assertNotNull($item->check_id); // freeze: evaluate() always records a check
            $this->assertNull($item->matched_recipe_id);
        }

        // The scripted generator saw one request per call.
        $this->assertSame(3, $scripted->calls);
        $this->assertSame('Weekly dinner rotation', $scripted->requests[0]->brief);
        $this->assertSame('Weekly dinner rotation', $scripted->requests[2]->brief);

        // Clean exit path releases the lease.
        $this->assertNull($batch->refresh()->lease_expires_at);
    }

    public function test_in_batch_duplicates_are_prevented_and_the_batch_exhausts(): void
    {
        // Spec §6 invariant: the FIRST accepted draft is INSERTED by the
        // registrar before the next candidate is evaluated, so the exact
        // same draft twice inside ONE generator response must collide
        // through the regular DB-backed identity/fingerprint indexes.
        $scripted = $this->scripted([
            fn (): array => [
                RecipeFixtures::foulMedames(),
                RecipeFixtures::foulMedames(),
                RecipeFixtures::foulMedames(),
            ],
        ]);

        // max_attempts = ceil(3 * 1 / 3) = 1 call — the whole response is
        // the verdict: 1 accepted + 2 in-batch duplicates, target 3
        // unreachable -> exhausted.
        $batch = $this->batch(3, ['batch_size' => 3, 'max_attempt_multiplier' => 1]);

        app(BatchGenerationService::class)->run($batch);

        $batch = $batch->refresh();
        $this->assertSame(RecipeGenerationBatch::STATUS_EXHAUSTED, $batch->status);
        $this->assertSame(1, Recipe::query()->count());
        $this->assertSame(1, $batch->accepted_count);
        $this->assertSame(2, $batch->rejected_count);

        $items = $batch->items()->orderBy('id')->get();
        $this->assertSame(
            [RecipeGenerationBatchItem::ACTION_ACCEPTED, RecipeGenerationBatchItem::ACTION_DUPLICATE, RecipeGenerationBatchItem::ACTION_DUPLICATE],
            $items->pluck('action')->all()
        );

        // Each duplicate matched the one accepted recipe (in-batch or the
        // judge's matched id — both point at the inserted row).
        $acceptedRecipeId = (int) Recipe::query()->value('id');
        foreach ($items->where('action', RecipeGenerationBatchItem::ACTION_DUPLICATE) as $item) {
            $this->assertSame($acceptedRecipeId, (int) $item->matched_recipe_id);
        }

        // Ops guidance is embedded in the error (the review slice reads it).
        $this->assertStringContainsString('Accepted 1 of 3 after 1 generation calls (duplicates: 2, failed: 0, review: 0)', (string) $batch->error);
        $this->assertStringContainsString('DEDUP_GENERATION_MAX_ATTEMPT_MULTIPLIER', (string) $batch->error);
        $this->assertSame(1, $scripted->calls); // cap respected, no infinite loop
    }

    public function test_duplicate_against_pre_existing_library_recipe(): void
    {
        $existing = Recipe::create(['title' => 'Egyptian Ful Medames', 'steps_count' => 5]);
        app(FingerprintService::class)->register($existing, CandidateRecipe::fromDraft(RecipeFixtures::foulMedames()));

        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);
        $batch = $this->batch(1, ['batch_size' => 10]);

        app(BatchGenerationService::class)->run($batch);

        $this->assertSame(1, Recipe::query()->count()); // no extra row
        $item = RecipeGenerationBatchItem::query()->sole();
        $this->assertSame(RecipeGenerationBatchItem::ACTION_DUPLICATE, $item->action);
        $this->assertSame($existing->id, (int) $item->matched_recipe_id);
        $this->assertNull($item->recipe_id);
        $this->assertNotNull($item->check_id);

        $batch = $batch->refresh();
        $this->assertSame(0, $batch->accepted_count);
        $this->assertSame(1, $batch->rejected_count);
    }

    public function test_needs_review_candidates_are_never_auto_accepted(): void
    {
        // Classic vs spicy Alfredo is the calibrated verify-band pair: it
        // reaches the AI judge. A judge outage (on_failure: flag) then
        // must flag, NOT accept.
        $classic = Recipe::create(['title' => 'Chicken Alfredo Fettuccine']);
        app(FingerprintService::class)->register($classic, CandidateRecipe::fromDraft(RecipeFixtures::chickenAlfredoClassic()));

        $this->judge->throws = new AiJudgeException('judge unreachable');

        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::chickenAlfredoSpicy()],
        ]);
        $batch = $this->batch(1, ['batch_size' => 10]);

        app(BatchGenerationService::class)->run($batch);

        $this->assertSame(1, Recipe::query()->count()); // only the pre-existing row
        $item = RecipeGenerationBatchItem::query()->sole();
        $this->assertSame(RecipeGenerationBatchItem::ACTION_NEEDS_REVIEW, $item->action);
        $this->assertNull($item->recipe_id);

        $batch = $batch->refresh();
        $this->assertSame(1, $batch->rejected_count);
        $this->assertSame(0, $batch->accepted_count);
    }

    public function test_halal_rejections_are_content_failures_without_check_rows(): void
    {
        $scripted = $this->scripted([
            fn (): array => [$this->haramDraft()],
        ]);
        $batch = $this->batch(1, ['batch_size' => 10]);

        app(BatchGenerationService::class)->run($batch);

        $this->assertSame(0, Recipe::query()->count());
        $item = RecipeGenerationBatchItem::query()->sole();
        $this->assertSame('Bacon and Whisky Glazed Steak', $item->title);
        $this->assertSame('halal_content: bacon, whisky', $item->reason);
        $this->assertSame(RecipeGenerationBatchItem::ACTION_GENERATION_FAILED, $item->action);
        $this->assertNull($item->check_id); // content failure — never a dedup decision

        $batch = $batch->refresh();
        $this->assertSame(1, $batch->failed_count);
        $this->assertSame(0, $batch->rejected_count); // NOT a duplicate
        $this->assertSame(0, $batch->accepted_count);
    }

    public function test_empty_titled_drafts_are_content_failures(): void
    {
        $scripted = $this->scripted([
            fn (): array => [
                array_merge(RecipeFixtures::foulMedames(), ['title' => '   ']),
            ],
        ]);
        $batch = $this->batch(1, ['batch_size' => 10]);

        app(BatchGenerationService::class)->run($batch);

        $item = RecipeGenerationBatchItem::query()->sole();
        $this->assertSame(RecipeGenerationBatchItem::ACTION_GENERATION_FAILED, $item->action);
        $this->assertSame('empty_title', $item->reason);
        $this->assertSame(1, $batch->refresh()->failed_count);
        $this->assertSame(0, Recipe::query()->count());
    }

    public function test_generator_failures_are_one_failed_call_each_and_not_fatal(): void
    {
        $scripted = $this->scripted([
            function (GenerationRequest $request): array {
                throw new GenerationException('[recipe generator] HTTP 503');
            },
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);
        $batch = $this->batch(1, ['batch_size' => 1]);

        app(BatchGenerationService::class)->run($batch);

        $batch = $batch->refresh();
        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $batch->status);
        $this->assertSame(2, $batch->generation_attempts);
        $this->assertSame(1, $batch->failed_count);
        $this->assertSame(1, $batch->accepted_count);
        $this->assertSame(2, $scripted->calls);

        $failedItem = $batch->items()->where('action', RecipeGenerationBatchItem::ACTION_GENERATION_FAILED)->sole();
        $this->assertStringContainsString('HTTP 503', (string) $failedItem->reason);
    }

    public function test_running_batch_with_a_foreign_lease_refuses_to_run(): void
    {
        $batch = $this->batch(1, ['batch_size' => 1]);
        $this->assertTrue($batch->claimLease(600)); // another worker owns it

        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);

        $thrown = null;
        try {
            app(BatchGenerationService::class)->run($batch);
        } catch (GenerationException $e) {
            $thrown = $e;
        }

        $this->assertNotNull($thrown);
        $this->assertSame('batch already claimed or terminal', $thrown->getMessage());
        $this->assertSame(0, $scripted->calls); // nothing ran on the leased batch

        // A crashed/abandoned claim expires -> the same run() succeeds.
        $batch->releaseLease();
        $batch = app(BatchGenerationService::class)->run($batch);

        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $batch->refresh()->status);
        $this->assertSame(1, $batch->accepted_count);
    }

    public function test_running_batch_is_resumed_from_the_database_after_a_crash(): void
    {
        // Simulate a worker that died mid-batch after its first accept.
        $crashed = Recipe::create(['title' => 'Chicken Alfredo Fettuccine', 'steps_count' => 5]);
        app(FingerprintService::class)->register($crashed, CandidateRecipe::fromDraft(RecipeFixtures::chickenAlfredoClassic()));

        $batch = $this->batch(2, ['batch_size' => 1]);
        $batch->forceFill([
            'status' => RecipeGenerationBatch::STATUS_RUNNING,
            'accepted_count' => 1,
            'generation_attempts' => 1,
            'max_attempts' => 6, // ceil(2 * 3 / 1)
            'started_at' => now()->subMinutes(35),
            'lease_expires_at' => now()->subMinutes(30), // stale: claimable again
        ])->save();
        $batch->items()->create([
            'action' => RecipeGenerationBatchItem::ACTION_ACCEPTED,
            'recipe_id' => $crashed->id,
            'check_id' => null,
            'title' => 'Chicken Alfredo Fettuccine',
        ]);

        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);

        $batch = app(BatchGenerationService::class)->run($batch);

        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $batch->refresh()->status);
        $this->assertSame(2, $batch->accepted_count); // DB counter carried over
        $this->assertSame(2, $batch->generation_attempts);
        $this->assertSame(1, $scripted->calls); // only the remaining target ran

        // The resumed call's avoid-titles resume from the item rows too.
        $this->assertContains('Chicken Alfredo Fettuccine', $scripted->requests[0]->avoidTitles);
    }

    public function test_running_a_completed_batch_is_idempotent(): void
    {
        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);
        $batch = $this->batch(1, ['batch_size' => 1]);

        app(BatchGenerationService::class)->run($batch);
        $second = app(BatchGenerationService::class)->run($batch);

        $batch = $batch->refresh();
        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $second->status);
        $this->assertSame($batch->id, $second->id);
        $this->assertSame(1, $scripted->calls); // re-run made NO generator calls
        $this->assertSame(1, $batch->accepted_count);
        $this->assertSame(1, $batch->generation_attempts);
    }

    public function test_exhaustion_when_the_generator_only_returns_duplicates(): void
    {
        $existing = Recipe::create(['title' => 'Egyptian Ful Medames']);
        app(FingerprintService::class)->register($existing, CandidateRecipe::fromDraft(RecipeFixtures::foulMedames()));

        $scripted = $this->scripted(array_fill(0, 4, fn (): array => [RecipeFixtures::foulMedames()]));
        // max_attempts = ceil(2 * 2 / 1) = 4 calls; every call is the same dupe.
        $batch = $this->batch(2, ['batch_size' => 1, 'max_attempt_multiplier' => 2]);

        app(BatchGenerationService::class)->run($batch);

        $batch = $batch->refresh();
        $this->assertSame(RecipeGenerationBatch::STATUS_EXHAUSTED, $batch->status);
        $this->assertSame(1, $batch->accepted_count); // exact: first call accepted
        $this->assertSame(3, $batch->rejected_count);
        $this->assertSame(4, $batch->generation_attempts);
        $this->assertSame(4, $batch->max_attempts);
        $this->assertSame(4, $scripted->calls); // loop count == cap, no infinite loop
        $this->assertStringContainsString('Accepted 1 of 2 after 4 generation calls (duplicates: 3, failed: 0, review: 0)', (string) $batch->error);
        $this->assertStringContainsString('DEDUP_GENERATION_MAX_ATTEMPT_MULTIPLIER', (string) $batch->error);
    }

    public function test_sync_command_creates_and_completes_a_batch(): void
    {
        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::chickenAlfredoClassic()],
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);

        $this->artisan('recipereal:generate-batch', [
            'requested_count' => '2',
            '--brief' => 'Italian dinner mains with an Egyptian bonus',
            '--cuisine' => 'italian',
            '--batch-size' => '1',
            '--max-attempt-multiplier' => '2',
            '--sync' => true,
        ])->assertExitCode(0);

        $batch = RecipeGenerationBatch::query()->sole();
        $this->assertSame(RecipeGenerationBatch::STATUS_COMPLETED, $batch->status);
        $this->assertSame(2, $batch->requested_count);
        $this->assertSame('italian', $batch->cuisine);
        $this->assertSame('Italian dinner mains with an Egyptian bonus', $batch->params['brief']);
        $this->assertSame('en', $batch->params['language']); // default
        $this->assertSame(1, $batch->params['batch_size']); // per-batch override
        $this->assertSame(2.0, $batch->params['max_attempt_multiplier']);
        $this->assertSame(2, Recipe::query()->count());
        $this->assertSame(2, $batch->accepted_count);
        $this->assertSame(2, $scripted->calls);

        $items = RecipeGenerationBatchItem::query()->orderBy('id')->get();
        $this->assertSame([RecipeGenerationBatchItem::ACTION_ACCEPTED, RecipeGenerationBatchItem::ACTION_ACCEPTED], $items->pluck('action')->all());
    }

    public function test_queue_command_dispatches_the_batch_job(): void
    {
        Queue::fake();

        $this->artisan('recipereal:generate-batch', ['requested_count' => '5'])
            ->assertExitCode(0);

        $batch = RecipeGenerationBatch::query()->sole();
        $this->assertSame(RecipeGenerationBatch::STATUS_CREATED, $batch->status); // untouched until the worker runs
        $this->assertSame(5, $batch->requested_count);

        Queue::assertPushed(function (ProcessRecipeGenerationBatch $job) use ($batch): bool {
            return $job->batchId === $batch->id && $job->tries === 1;
        });
    }

    public function test_command_resolves_the_owner_row(): void
    {
        $chef = User::create([
            'name' => 'Chef',
            'email' => 'chef@example.test',
            'password' => 'secret',
        ]);
        config(['recipe_dedup.generation.owner_email' => 'chef@example.test']);

        $scripted = $this->scripted([
            fn (): array => [RecipeFixtures::foulMedames()],
        ]);

        $this->artisan('recipereal:generate-batch', [
            'requested_count' => '1',
            '--sync' => true,
        ])->assertExitCode(0);

        $batch = RecipeGenerationBatch::query()->sole();
        $this->assertSame($chef->id, (int) $batch->params['owner_id']);

        // The generation request carried the owner into its meta.
        $this->assertSame($chef->id, $scripted->requests[0]->meta['owner_id']);
    }

    public function test_command_falls_back_to_the_first_filament_admin(): void
    {
        config(['admin.emails' => 'boss@example.test,staff@example.test']);

        $staff = User::create(['name' => 'Staff', 'email' => 'staff@example.test', 'password' => 'x']);
        $boss = User::create(['name' => 'Boss', 'email' => 'boss@example.test', 'password' => 'x']);

        $this->artisan('recipereal:generate-batch', ['requested_count' => '1', '--sync' => true])
            ->assertExitCode(0);

        $batch = RecipeGenerationBatch::query()->sole();
        // "first admin" = lowest id among the admin.emails list.
        $this->assertSame(min($staff->id, $boss->id), (int) $batch->params['owner_id']);
    }

    public function test_command_rejects_non_positive_requested_counts(): void
    {
        $this->artisan('recipereal:generate-batch', ['requested_count' => '0'])
            ->assertExitCode(1);

        $this->artisan('recipereal:generate-batch', ['requested_count' => '-3'])
            ->assertExitCode(1);

        $this->assertSame(0, RecipeGenerationBatch::query()->count());
    }

    /**
     * The scripted generator: one anonymous class, one closure per expected
     * generator call. End-of-script calls return an empty list (within the
     * 0..count contract).
     *
     * @param  list<callable(GenerationRequest): list<array<string, mixed>>>  $script
     */
    private function scripted(array $script): object
    {
        return $this->generator = new class($script) implements RecipeCandidateGenerator
        {
            public int $calls = 0;

            /** @var list<GenerationRequest> */
            public array $requests = [];

            /** @var list<callable(GenerationRequest): list<array<string, mixed>>> */
            public array $script;

            /** @param  list<callable(GenerationRequest): list<array<string, mixed>>>  $script */
            public function __construct(array $script)
            {
                $this->script = $script;
            }

            public function generate(GenerationRequest $request): array
            {
                $this->calls++;
                $this->requests[] = $request;

                $next = $this->script[$this->calls - 1] ?? null;

                return $next === null ? [] : $next($request);
            }
        };
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function batch(int $requested, array $params = []): RecipeGenerationBatch
    {
        return RecipeGenerationBatch::create([
            'requested_count' => $requested,
            'params' => array_merge(['brief' => 'Weekly dinner rotation'], $params),
            'status' => RecipeGenerationBatch::STATUS_CREATED,
        ]);
    }

    /** @return array<string, mixed> */
    private function haramDraft(): array
    {
        return [
            'title' => 'Bacon and Whisky Glazed Steak',
            'description' => 'Pan-seared steak with a bacon crust and a whisky butter glaze.',
            'ingredients' => [
                '900 g beef steak',
                '4 strips bacon, finely chopped',
                '60 ml whisky',
                '50 g butter',
            ],
            'steps' => [
                'Sear the steak, then crisp the bacon around it.',
                'Deglaze with whisky and swirl in the butter to glaze.',
            ],
            'category' => 'Main',
            'cuisine' => 'american',
        ];
    }
}
