<?php

namespace Tests\Feature;

use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Android App Links + the "Get the app" banner on the public share pages
 * (/r, /p, /u). NO hard redirect ever — every visitor sees the real shared
 * content, and every NON-CRAWLER browser also gets the injected banner
 * (product decision: a visitor must be told the app is the way in). Only
 * the banner's LINK is smart: the Play listing when PLAY_STORE_URL is set,
 * the direct APK (/download) on Android browsers when a release is
 * uploaded, else the landing page. Crawlers get the clean page with NO
 * banner (their WhatsApp preview cards depend on it). The
 * /.well-known/assetlinks.json statement serves every configured signing
 * fingerprint for domain verification.
 */
class ShareRedirectTest extends TestCase
{
    use RefreshDatabase;

    private const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

    private const WHATSAPP_BOT = 'WhatsApp/2.24.19.78 A';

    private const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

    private const DESKTOP_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0';

    private function recipe(): Recipe
    {
        return Recipe::create([
            'title' => 'Share Redirect Test',
            'source_type' => 'foodcom',
            'ingredients' => json_encode(['x']),
            'steps' => json_encode([['description' => 'Cook.']]),
            'steps_count' => 1,
        ]);
    }

    public function test_android_browser_gets_page_with_store_banner_when_configured(): void
    {
        config()->set('recipereal.play_store_url', 'https://play.google.com/store/apps/details?id=com.recipereal.app');

        // Facebook-style: NO hard redirect — the visitor sees the shared
        // content AND the injected "Get the app" banner pointing at the store.
        $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME])
            ->assertOk()
            ->assertSee('rr-store-banner', false)
            ->assertSee('https://play.google.com/store/apps/details?id=com.recipereal.app', false)
            ->assertSee('RecipeReal', false);
    }

    /** No store URL yet: Android browsers get the direct APK link. */
    public function test_android_browser_banner_points_at_apk_when_release_uploaded(): void
    {
        config()->set('recipereal.play_store_url', '');
        \App\Models\AppRelease::create([
            'version' => '1.2.0',
            'file_path' => 'apks/test-release.apk',
            'file_size' => 1024,
        ]);

        $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME])
            ->assertOk()
            ->assertSee('rr-store-banner', false)
            ->assertSee('/download', false)
            ->assertSee('Open in app', false);
    }

    /** Android browsers get the verification-free "Open in app" intent pill:
     * a package-pinned intent:// link that Chrome turns into an app launch
     * even when the domain verification failed (MIUI sideloads), falling
     * back to this same page when the app is not installed. */
    public function test_android_banner_carries_intent_open_in_app_pill(): void
    {
        config()->set('recipereal.play_store_url', '');
        \App\Models\AppRelease::create([
            'version' => '1.2.0',
            'file_path' => 'apks/test-release.apk',
            'file_size' => 1024,
        ]);

        $response = $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME]);
        $html = $response->getContent();
        $this->assertStringContainsString('intent://r/', $html);
        $this->assertStringContainsString('scheme=recipereal;package=com.recipereal.app', $html);
        $this->assertStringContainsString('S.browser_fallback_url=', $html);
    }

    /** The /u page's intent maps onto the user/{id} scheme route that also
     * exists on builds older than the /u App Links wave. */
    public function test_profile_page_intent_maps_u_onto_user_scheme_route(): void
    {
        config()->set('recipereal.play_store_url', '');
        $cook = \App\Models\User::factory()->create(['display_name' => 'Intent Chef']);

        $html = $this->get('/u/'.$cook->id, ['User-Agent' => self::ANDROID_CHROME])->getContent();
        $this->assertStringContainsString('intent://user/'.$cook->id.'#Intent;scheme=recipereal', $html);
    }

    /** Desktop/iOS banners never carry the intent pill (intent:// is an
     * Android-only launch mechanism). */
    public function test_desktop_banner_has_no_intent_pill(): void
    {
        config()->set('recipereal.play_store_url', '');

        $html = $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::DESKTOP_FIREFOX])->getContent();
        $this->assertStringContainsString('rr-store-banner', $html);
        $this->assertStringNotContainsString('intent://', $html);
    }

    /** No release uploaded either: the banner falls back to the landing
     * (never a link that 404s — /download aborts with no releases). */
    public function test_android_browser_banner_falls_back_to_landing_without_release(): void
    {
        config()->set('recipereal.play_store_url', '');

        $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME])
            ->assertOk()
            ->assertSee('rr-store-banner', false);
    }

    /** Desktop and iOS also see the banner now, but pointed at the landing
     * (they cannot install an APK). */
    public function test_desktop_and_ios_get_banner_pointed_at_landing(): void
    {
        config()->set('recipereal.play_store_url', '');

        foreach ([self::IPHONE, self::DESKTOP_FIREFOX] as $ua) {
            $this->get('/r/'.$this->recipe()->id, ['User-Agent' => $ua])
                ->assertOk()
                ->assertSee('rr-store-banner', false)
                ->assertDontSee('intent://', false);
        }
    }

    public function test_crawler_gets_clean_page_without_banner(): void
    {
        config()->set('recipereal.play_store_url', 'https://play.google.com/store/apps/details?id=com.recipereal.app');
        $id = $this->recipe()->id;
        $postId = \App\Models\Post::create([
            'user_id' => \App\Models\User::factory()->create()->id,
            'body' => 'WhatsApp preview guard test',
        ])->id;

        foreach ([self::WHATSAPP_BOT] as $ua) {
            $response = $this->get('/r/'.$id, ['User-Agent' => $ua])->assertOk();
            $this->assertStringNotContainsString('rr-store-banner', $response->getContent());
        }
        // Same guard on the post page.
        $this->get('/p/'.$postId, ['User-Agent' => self::WHATSAPP_BOT])->assertOk();
    }

    public function test_assetlinks_serves_configured_fingerprints(): void
    {
        config()->set('recipereal.app_links_sha256', 'AA:BB, CC:DD');
        config()->set('recipereal.android_package', 'com.recipereal.app');

        $res = $this->getJson('/.well-known/assetlinks.json');
        $res->assertOk();
        $statement = $res->json('0');
        $this->assertSame('delegate_permission/common.handle_all_urls', $statement['relation'][0]);
        $this->assertSame('com.recipereal.app', $statement['target']['package_name']);
        $this->assertSame(['AA:BB', 'CC:DD'], $statement['target']['sha256_cert_fingerprints']);
    }

    public function test_assetlinks_empty_when_no_fingerprints_configured(): void
    {
        config()->set('recipereal.app_links_sha256', '');

        $this->getJson('/.well-known/assetlinks.json')->assertOk()->assertJson([]);
    }
}
