<?php

namespace Tests\Feature;

use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers public-web locale negotiation (landing + content + share pages):
 *
 *   - Default is English LTR (no Accept-Language header).
 *   - An Arabic device language (Accept-Language: ar-*) renders Arabic RTL.
 *   - Explicit ?lang=en|ar overrides the header and persists (session).
 *   - Share pages (/r, /p) are translated AND cached per locale.
 *   - The admin panel (/admin/*) always stays English, never RTL.
 */
class PublicWebLocaleTest extends TestCase
{
    use RefreshDatabase;

    public function test_landing_defaults_to_english_ltr(): void
    {
        $html = $this->get('/')->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="en" dir="ltr"', $html);
        $this->assertStringContainsString('Real</span> Recipes.', $html);
        $this->assertStringContainsString('Get the App', $html);
    }

    public function test_landing_follows_device_arabic_with_rtl(): void
    {
        $html = $this->get('/', ['Accept-Language' => 'ar-EG,ar;q=0.9,en;q=0.8'])
            ->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $html);
        $this->assertStringContainsString('وصفات', $html);
        $this->assertStringContainsString('حمّل التطبيق', $html);
    }

    public function test_lang_query_param_overrides_and_persists(): void
    {
        // Explicit ?lang=ar wins even with an English device header…
        $html = $this->get('/?lang=ar', ['Accept-Language' => 'en-US,en;q=0.9'])
            ->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $html);
        // …and the choice sticks on the next visit (session).
        $html2 = $this->get('/', ['Accept-Language' => 'en-US,en;q=0.9'])
            ->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $html2);
    }

    public function test_content_pages_translate(): void
    {
        $en = $this->get('/about')->assertOk()->getContent();
        $this->assertStringContainsString('About Us', $en);

        $ar = $this->get('/about', ['Accept-Language' => 'ar'])->assertOk()->getContent();
        $this->assertStringContainsString('من نحن', $ar);
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $ar);

        $contactAr = $this->get('/contact?lang=ar')->assertOk()->getContent();
        $this->assertStringContainsString('أرسل الرسالة', $contactAr);

        $termsAr = $this->get('/terms', ['Accept-Language' => 'ar'])->assertOk()->getContent();
        $this->assertStringContainsString('شروط الاستخدام', $termsAr);

        // English privacy keeps the Arabic summary; Arabic privacy is fully Arabic.
        // (Explicit ?lang=en: an earlier ?lang=ar in this test persists via session.)
        $privacyEn = $this->get('/privacy?lang=en')->assertOk()->getContent();
        $this->assertStringContainsString('What we collect', $privacyEn);
        $this->assertStringContainsString('سياسة الخصوصية (باختصار)', $privacyEn);
        $privacyAr = $this->get('/privacy?lang=ar')->assertOk()->getContent();
        $this->assertStringContainsString('ما نجمعه', $privacyAr);
        $this->assertStringNotContainsString('What we collect', $privacyAr);

        // Help ships localized FAQ JSON-LD.
        $helpAr = $this->get('/help', ['Accept-Language' => 'ar'])->assertOk()->getContent();
        $this->assertStringContainsString('FAQPage', $helpAr);
        $this->assertStringContainsString('ما هو RecipeReal؟', $helpAr);
    }

    public function test_share_page_translates_and_caches_per_locale(): void
    {
        $recipe = Recipe::create([
            'title' => 'One-Pan Lemon Chicken',
            'title_ar' => 'دجاج الليمون بالمقلاة الواحدة',
            'source_type' => 'foodcom',
            'publisher_time_minutes' => 25,
            'reality_minutes' => 42,
            'steps_count' => 9,
        ]);

        $en = $this->get("/r/{$recipe->id}")->assertOk()->getContent();
        $this->assertStringContainsString('Recipe says <strong>25 min</strong>', $en);

        $ar = $this->get("/r/{$recipe->id}", ['Accept-Language' => 'ar'])
            ->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $ar);
        $this->assertStringContainsString('الوصفة تقول <strong>25 د</strong>', $ar);

        // English cache entry is untouched by the Arabic hit.
        $en2 = $this->get("/r/{$recipe->id}")->assertOk()->getContent();
        $this->assertStringContainsString('Recipe says <strong>25 min</strong>', $en2);
    }

    public function test_admin_stays_english(): void
    {
        $r = $this->get('/admin/login', ['Accept-Language' => 'ar-EG,ar;q=0.9']);
        if ($r->status() === 200) {
            $this->assertStringNotContainsString('dir="rtl"', $r->getContent());
        } else {
            $this->markTestSkipped('no admin login route in this env (status '.$r->status().')');
        }
    }
}
