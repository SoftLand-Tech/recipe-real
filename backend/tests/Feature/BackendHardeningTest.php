<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Post;
use App\Models\Recipe;
use App\Models\RecipeNote;
use App\Models\User;
use App\Services\RecipeImport\PublicUrlGuard;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Hardening regression suite:
 *
 *   H4  — public surfaces (profile, community resources) never carry
 *         users.name / gender; neutral display fallback.
 *   H5  — PublicUrlGuard rejects loopback/private/metadata and every
 *         non-canonical IP spelling; literals never touch DNS.
 *   H6  — uploads: extension from validated CONTENT mime (a .php upload
 *         stores as .png) and a 20/day per-user quota (21st -> 429).
 *   M5  — TypesenseSearch strips injected operator characters from the
 *         category facet and drops invalid filters entirely.
 *   M6  — like/unlike/like toggling cannot stack duplicate notifications
 *         inside the 7-day cooldown.
 *   M7  — post image URLs must be https + host-allowlisted.
 *   M11 — note destroy is author+recipe scoped; note report is idempotent.
 *   M16 — SecurityHeaders lands nosniff / frame-options / CSP on web GETs.
 *   spam — FilterSpam rejects honeypot + too-fast form submissions.
 */
class BackendHardeningTest extends TestCase
{
    use RefreshDatabase;

    /** Smallest valid 1x1 PNG — the content behind every upload test. */
    private function pngBytes(): string
    {
        return (string) base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            true,
        );
    }

    private function recipe(): Recipe
    {
        return Recipe::create([
            'title' => 'Test Curry',
            'source_type' => 'foodcom',
            'ingredients' => json_encode(['curry paste', 'coconut milk']),
            'steps' => json_encode([['description' => 'Simmer.']]),
            'steps_count' => 1,
        ]);
    }

    /** Enable the Typesense client against a fake daemon host. */
    private function enableTypesense(): void
    {
        config()->set('recipereal.typesense.host', 'typesense-test');
        config()->set('recipereal.typesense.port', 8108);
        config()->set('recipereal.typesense.api_key', 'test-key');
    }

    // ------------------------------------------------------------------
    // H4 — public profile leak
    // ------------------------------------------------------------------

    public function test_public_profile_hides_internal_name_and_gender(): void
    {
        $user = User::factory()->create([
            'name' => 'Mamoun Supersecret',
            'display_name' => 'Chef Mamoun',
            'gender' => 'male',
        ]);

        $identity = $this->getJson('/api/users/'.$user->id.'/profile')
            ->assertOk()
            ->json('user');

        $this->assertSame('Chef Mamoun', $identity['display_name']);
        $this->assertArrayNotHasKey('name', $identity);
        $this->assertArrayNotHasKey('gender', $identity);
    }

    public function test_public_profile_falls_back_to_neutral_display_name(): void
    {
        $user = User::factory()->create(['display_name' => null, 'gender' => 'female']);

        $this->getJson('/api/users/'.$user->id.'/profile')
            ->assertOk()
            ->assertJsonPath('user.display_name', 'A cook');
    }

    public function test_community_note_author_uses_public_identity_resource(): void
    {
        $author = User::factory()->create([
            'name' => 'Hidden Account Name',
            'display_name' => null,
        ]);
        $recipe = $this->recipe();
        RecipeNote::create([
            'user_id' => $author->id,
            'recipe_id' => $recipe->id,
            'body' => 'Salt earlier than you think.',
        ]);

        $authorRow = $this->getJson('/api/recipes/'.$recipe->id.'/notes')
            ->assertOk()
            ->json('data.0.user');

        $this->assertSame('A cook', $authorRow['display_name']);
        $this->assertArrayNotHasKey('name', $authorRow);
    }

    // ------------------------------------------------------------------
    // H5 — PublicUrlGuard SSRF
    // ------------------------------------------------------------------

    public function test_public_url_guard_rejects_private_and_noncanonical_hosts(): void
    {
        $guard = new PublicUrlGuard();

        $rejected = [
            'http://[::1]/x',                           // IPv6 loopback literal
            'http://127.0.0.1/x',                       // IPv4 loopback literal
            'http://2130706433/x',                      // decimal-encoded 127.0.0.1
            'http://0x7f000001/x',                      // hex-encoded loopback
            'http://0177.0.0.1/x',                      // octal-encoded loopback
            'http://127.1/x',                           // short-form loopback
            'http://10.0.0.5/x',                        // RFC1918
            'http://192.168.1.10/x',                    // RFC1918
            'http://100.64.0.1/x',                      // CGNAT
            'http://198.18.0.9/x',                      // benchmark range
            'http://224.0.0.1/x',                       // multicast
            'http://240.0.0.1/x',                       // reserved
            'http://169.254.169.254/latest/meta-data/', // cloud metadata
            'http://[::ffff:127.0.0.1]/x',              // v4-mapped v6 loopback
            'http://[fe80::1]/x',                       // v6 link local
            'http://[fc00::1]/x',                       // v6 unique local
            'http://localhost/x',                       // loopback name
            'http://metadata.google.internal/x',        // metadata name
        ];

        foreach ($rejected as $bad) {
            try {
                $guard->assertPublic($bad);
                $this->fail("Guard accepted a rejected URL: {$bad}");
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_public_url_guard_accepts_public_literal_without_dns(): void
    {
        // A public dotted-quad literal must pass without any DNS lookup.
        (new PublicUrlGuard)->assertPublic('https://93.184.216.34/recipe.jpg');

        $this->addToAssertionCount(1);
    }

    // ------------------------------------------------------------------
    // H6 — uploads: extension mapping + daily quota
    // ------------------------------------------------------------------

    public function test_upload_with_misleading_filename_and_png_content_stores_png(): void
    {
        // Force the local public disk (dev .env may carry AWS_BUCKET).
        config(['filesystems.disks.s3.bucket' => null]);
        Storage::fake('public');
        $user = User::factory()->create();

        // Simulates the real-upload vector: a PNG payload wearing an
        // executable-ish client filename. Laravel's testing File derives
        // its reported mime from the NAME, so ->mimeType('image/png')
        // stands in for the content sniffing a real UploadedFile does —
        // exactly the mime the controller must trust. A literal evil.php
        // name never even reaches the controller (the mimes rule
        // hard-blocks php/phtml/phar extensions).
        $file = UploadedFile::fake()
            ->createWithContent('evil.exe', $this->pngBytes())
            ->mimeType('image/png');

        $url = $this->actingAs($user, 'sanctum')
            ->postJson('/api/uploads', [
                'image' => $file,
            ])
            ->assertCreated()
            ->json('url');

        $this->assertStringEndsWith('.png', $url);
        $this->assertStringNotContainsString('.exe', $url);
    }

    public function test_upload_daily_quota_rejects_the_21st_file(): void
    {
        // Force the local public disk (dev .env may carry AWS_BUCKET).
        config(['filesystems.disks.s3.bucket' => null]);
        Storage::fake('public');
        $user = User::factory()->create();

        // Prime the day counter just under the cap (20/day).
        Cache::put(
            'uploads:day:'.$user->id.':'.now()->utc()->toDateString(),
            19,
            now()->utc()->endOfDay(),
        );

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/uploads', [
                'image' => UploadedFile::fake()->createWithContent('twentieth.png', $this->pngBytes()),
            ])
            ->assertCreated();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/uploads', [
                'image' => UploadedFile::fake()->createWithContent('twenty-first.png', $this->pngBytes()),
            ])
            ->assertStatus(429)
            ->assertJsonPath('message', 'Daily upload limit reached.');
    }

    // ------------------------------------------------------------------
    // M5 — TypesenseSearch category sanitization
    // ------------------------------------------------------------------

    public function test_search_sanitizes_and_drops_invalid_category_filters(): void
    {
        $this->enableTypesense();

        Http::fake([
            'http://typesense-test:8108/collections/recipes/documents/search*' =>
                Http::response(['found' => 0, 'page' => 1, 'hits' => []]),
            '*' => Http::response(['ok' => true]),
        ]);

        // 1. Clean category passes through normalized (lowercase, trimmed).
        $this->getJson('/api/recipes/search?q=soup&category=Main%20Dish')->assertOk();
        $query = [];
        parse_str(parse_url(Http::recorded()[0][0]->url(), PHP_URL_QUERY), $query);
        $this->assertSame('category:=main dish', $query['filter_by']);

        // 2. Injection attempt: backticks/colons stripped; the remainder is
        //    a harmless literal that can never match a stored facet.
        $injected = 'main'.chr(96).'dish:'.chr(96).'filter';
        $this->getJson('/api/recipes/search?q=soup&category='.urlencode($injected))->assertOk();
        $query = [];
        parse_str(parse_url(Http::recorded()[1][0]->url(), PHP_URL_QUERY), $query);
        $this->assertSame('category:=maindishfilter', $query['filter_by']);

        // 3. Invalid category (non latin-letter facet shape) → the filter
        //    is dropped entirely instead of erroring the search.
        $this->getJson('/api/recipes/search?q=soup&category='.urlencode('فئة'))->assertOk();
        $query = [];
        parse_str(parse_url(Http::recorded()[2][0]->url(), PHP_URL_QUERY), $query);
        $this->assertArrayNotHasKey('filter_by', $query);
    }

    // ------------------------------------------------------------------
    // M6 — notification cooldown
    // ------------------------------------------------------------------

    public function test_like_unlike_like_creates_only_one_notification(): void
    {
        $author = User::factory()->create();
        $liker = User::factory()->create();
        $post = Post::create([
            'user_id' => $author->id,
            'body' => 'Knead less, bake more.',
        ]);

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', true);
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());

        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', false);
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());

        // Re-like within the 7-day cooldown: the like toggles, the
        // notification does NOT stack a second row.
        $this->actingAs($liker, 'sanctum')
            ->postJson("/api/posts/{$post->id}/like")
            ->assertJsonPath('liked', true);
        $this->assertSame(1, Notification::where('user_id', $author->id)->count());
    }

    // ------------------------------------------------------------------
    // M7 — image host allowlist
    // ------------------------------------------------------------------

    public function test_post_image_urls_must_be_https_and_allowlisted(): void
    {
        $user = User::factory()->create();
        config(['recipereal.uploads.allowed_image_hosts' => ['cdn.example.com']]);

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'body' => 'Made shakshuka!',
                'images' => ['https://cdn.example.com/a.jpg'],
            ])
            ->assertCreated();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'body' => 'Not my CDN.',
                'images' => ['https://evil.example.net/a.jpg'],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['images.0']);

        // https-only: the app.url host is allowlisted but plain http is not.
        $this->actingAs($user, 'sanctum')
            ->postJson('/api/posts', [
                'body' => 'Downgraded scheme.',
                'image_url' => 'http://localhost:8000/storage/recipes/a.png',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['image_url']);
    }

    // ------------------------------------------------------------------
    // M11 — note destroy + report
    // ------------------------------------------------------------------

    public function test_note_destroy_is_author_and_recipe_scoped(): void
    {
        $author = User::factory()->create();
        $stranger = User::factory()->create();
        $recipe = $this->recipe();
        $otherRecipe = $this->recipe();
        $note = RecipeNote::create([
            'user_id' => $author->id,
            'recipe_id' => $recipe->id,
            'body' => 'Rest the dough overnight.',
        ]);

        // Guest -> 401.
        $this->deleteJson("/api/recipes/{$recipe->id}/notes/{$note->id}")
            ->assertUnauthorized();

        // Non-author -> 403.
        $this->actingAs($stranger, 'sanctum')
            ->deleteJson("/api/recipes/{$recipe->id}/notes/{$note->id}")
            ->assertForbidden();

        // Right note, WRONG recipe in the path -> 403 (binding scopes by id).
        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/recipes/{$otherRecipe->id}/notes/{$note->id}")
            ->assertForbidden();

        // Author, right recipe -> 204.
        $this->actingAs($author, 'sanctum')
            ->deleteJson("/api/recipes/{$recipe->id}/notes/{$note->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('recipe_notes', ['id' => $note->id]);
    }

    public function test_note_report_is_idempotent(): void
    {
        $reporter = User::factory()->create();
        $author = User::factory()->create();
        $recipe = $this->recipe();
        $note = RecipeNote::create([
            'user_id' => $author->id,
            'recipe_id' => $recipe->id,
            'body' => 'Buy the cheap paprika, honestly.',
        ]);

        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/recipes/{$recipe->id}/notes/{$note->id}/report", [
                'reason' => 'Spam link in the note.',
            ])
            ->assertStatus(201)
            ->assertJsonPath('ok', true);

        $this->assertDatabaseHas('note_reports', [
            'note_id' => $note->id,
            'user_id' => $reporter->id,
        ]);

        // Second report: still a single row, calm 200 "already reported".
        $this->actingAs($reporter, 'sanctum')
            ->postJson("/api/recipes/{$recipe->id}/notes/{$note->id}/report")
            ->assertStatus(200)
            ->assertJsonPath('message', 'already reported');

        $this->assertDatabaseCount('note_reports', 1);
    }

    // ------------------------------------------------------------------
    // M16 — SecurityHeaders
    // ------------------------------------------------------------------

    public function test_security_headers_land_on_web_get_responses(): void
    {
        $response = $this->get('/privacy')
            ->assertOk()
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        $csp = (string) $response->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("default-src 'self'", $csp);
        $this->assertStringContainsString('img-src', $csp);

        // Plain-http test requests must NOT promise HSTS.
        $this->assertNull($response->headers->get('Strict-Transport-Security'));
    }

    // ------------------------------------------------------------------
    // FilterSpam — registered as the 'spam' alias (the Lead attaches it
    // to the two public form POST routes)
    // ------------------------------------------------------------------

    public function test_filter_spam_rejects_honeypot_and_fast_submissions(): void
    {
        $middleware = new \App\Http\Middleware\FilterSpam();
        $next = fn () => response('ok');

        $makeRequest = fn (array $payload): Request => tap(
            Request::create('/contact', 'POST', $payload),
            function (Request $request): void {
                $request->setLaravelSession(app('session.store'));
                $this->app->instance('request', $request);
            }
        );

        // Honeypot filled -> rejected (web -> redirect back).
        $this->assertSame(302, $middleware->handle($makeRequest([
            'email' => 'bot@spam.example',
            'message' => 'Buy my thing.',
            'website' => 'https://spam.example',
            'form_loaded_at' => time() - 30,
        ]), $next)->getStatusCode());

        // Missing form_loaded_at -> rejected (fails closed).
        $this->assertSame(302, $middleware->handle($makeRequest([
            'email' => 'bot@spam.example',
            'message' => 'Buy my thing.',
        ]), $next)->getStatusCode());

        // Submitting 1s after render -> rejected (too fast for a human).
        $this->assertSame(302, $middleware->handle($makeRequest([
            'email' => 'human@example.com',
            'message' => 'Genuinely just typing fast.',
            'form_loaded_at' => time() - 1,
        ]), $next)->getStatusCode());

        // Clean, aged submission -> passes through.
        $this->assertSame(200, $middleware->handle($makeRequest([
            'email' => 'human@example.com',
            'message' => 'Lovely recipes, thank you.',
            'form_loaded_at' => time() - 10,
        ]), $next)->getStatusCode());
    }

    // ------------------------------------------------------------------
    // M9 — retention prune commands are registered
    // ------------------------------------------------------------------

    public function test_retention_prune_commands_are_registered(): void
    {
        $this->artisan('list')->expectsOutputToContain('recipereal:prune-installs');
        $this->artisan('list')->expectsOutputToContain('recipereal:prune-contact-messages');
    }
}
