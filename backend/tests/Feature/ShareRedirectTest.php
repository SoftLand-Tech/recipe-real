<?php

namespace Tests\Feature;

use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Android App Links + the Play Store smart redirect on the public share
 * pages (/r, /p): Android BROWSERS (no app installed, link not intercepted)
 * are 302'd to the store when configured; crawlers, desktops and iOS always
 * get the real page (their WhatsApp preview cards depend on it). The
 * /.well-known/assetlinks.json statement serves every configured signing
 * fingerprint for domain verification.
 */
class ShareRedirectTest extends TestCase
{
    use RefreshDatabase;

    private const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';

    private const WHATSAPP_BOT = 'WhatsApp/2.24.19.78 A';

    private const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

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

    public function test_android_browser_redirects_to_store_when_configured(): void
    {
        config()->set('recipereal.play_store_url', 'https://play.google.com/store/apps/details?id=com.recipereal.app');

        $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME])
            ->assertStatus(302)
            ->assertRedirect('https://play.google.com/store/apps/details?id=com.recipereal.app');
    }

    public function test_android_browser_gets_the_page_when_store_url_unset(): void
    {
        config()->set('recipereal.play_store_url', '');

        $this->get('/r/'.$this->recipe()->id, ['User-Agent' => self::ANDROID_CHROME])
            ->assertOk()
            ->assertSee('RecipeReal', false);
    }

    public function test_crawlers_desktops_and_ios_never_redirect(): void
    {
        config()->set('recipereal.play_store_url', 'https://play.google.com/store/apps/details?id=com.recipereal.app');
        $id = $this->recipe()->id;
        $postId = \App\Models\Post::create([
            'user_id' => \App\Models\User::factory()->create()->id,
            'body' => 'WhatsApp preview guard test',
        ])->id;

        foreach ([self::WHATSAPP_BOT, self::IPHONE, 'Mozilla/5.0 (X11; Linux x86_64) Firefox/127.0'] as $ua) {
            $this->get('/r/'.$id, ['User-Agent' => $ua])->assertOk();
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
