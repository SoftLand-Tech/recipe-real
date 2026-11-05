<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the public web account-deletion page + request form
 * (third-party store compliance: APKPure, Uptodown, Samsung Galaxy
 * Store, Xiaomi GetApps, Huawei AppGallery and the Amazon Appstore all
 * require a web URL where users can request account deletion):
 *
 *   - GET /account/delete renders in English and Arabic (RTL).
 *   - The landing footer and the privacy policy link to the page.
 *   - POST /account/delete-request queues a ContactMessage marked
 *     [ACCOUNT DELETION REQUEST] and redirects back with sent=1#form.
 *   - An invalid email fails validation and queues nothing.
 *
 * The web form is a REQUEST queue only — it never deletes accounts
 * itself (no auth, no account access); the operator verifies identity
 * and deletes from the admin panel.
 */
class AccountDeletionPageTest extends TestCase
{
    use RefreshDatabase;

    public function test_page_renders_in_english_ltr(): void
    {
        $html = $this->get('/account/delete')->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="en" dir="ltr"', $html);
        $this->assertStringContainsString('What gets deleted', $html);
        $this->assertStringContainsString('DELETE /api/account', $html);
    }

    public function test_page_renders_in_arabic_rtl(): void
    {
        $html = $this->get('/account/delete', ['Accept-Language' => 'ar-EG,ar;q=0.9'])
            ->assertOk()->getContent();
        $this->assertStringContainsString('<html lang="ar" dir="rtl"', $html);
        $this->assertStringContainsString('ما الذي يُحذف', $html);
        $this->assertStringContainsString('أرسل طلب الحذف', $html);
    }

    public function test_footer_links_to_the_deletion_page(): void
    {
        // The shared footer partial covers every content page; the landing
        // has its own inlined footer and must carry the link too (store
        // reviewers often start at the marketing site).
        $about = $this->get('/about')->assertOk()->getContent();
        $this->assertStringContainsString('/account/delete', $about);
        $this->assertStringContainsString('>Delete account</a>', $about);

        $landing = $this->get('/')->assertOk()->getContent();
        $this->assertStringContainsString('/account/delete', $landing);
    }

    public function test_privacy_policy_links_from_the_account_section(): void
    {
        $html = $this->get('/privacy')->assertOk()->getContent();
        $this->assertStringContainsString('/account/delete', $html);
        $this->assertStringContainsString('account deletion page', $html);
    }

    public function test_request_form_queues_a_marked_contact_message(): void
    {
        // Honeypot fields for the spam middleware (empty trap + aged timestamp).
        $response = $this->post('/account/delete-request', [
            'name' => 'Amina',
            'email' => 'amina@example.com',
            'message' => 'Please delete my account and data.',
            'website' => '',
            'form_loaded_at' => (string) (now()->timestamp - 10),
        ]);

        // Redirects back to the form anchor with the success flag.
        $response->assertRedirect();
        $location = $response->headers->get('Location');
        $this->assertStringContainsString('/account/delete', $location);
        $this->assertStringContainsString('sent=1', $location);
        $this->assertStringContainsString('#form', $location);

        $this->assertDatabaseCount('contact_messages', 1);
        $stored = ContactMessage::sole();
        $this->assertSame('amina@example.com', $stored->email);
        $this->assertSame('Amina', $stored->name);
        $this->assertStringStartsWith('[ACCOUNT DELETION REQUEST]', $stored->message);
        $this->assertStringContainsString('Please delete my account and data.', $stored->message);

        // The redirect target renders a visible success message.
        $html = $this->get('/account/delete?sent=1')->assertOk()->getContent();
        $this->assertStringContainsString('Request received', $html);
    }

    public function test_request_form_accepts_a_bare_email(): void
    {
        // Name and message are optional — an email alone still queues the request.
        $this->post('/account/delete-request', [
            'email' => 'sara@example.com',
            'website' => '',
            'form_loaded_at' => (string) (now()->timestamp - 10),
        ])->assertRedirect();

        $stored = ContactMessage::sole();
        $this->assertNull($stored->name);
        $this->assertSame('sara@example.com', $stored->email);
        $this->assertStringStartsWith('[ACCOUNT DELETION REQUEST]', $stored->message);
    }

    public function test_request_form_rejects_an_invalid_email(): void
    {
        $this->post('/account/delete-request', [
            'email' => 'not-an-email',
            'message' => 'delete everything',
            'website' => '',
            'form_loaded_at' => (string) (now()->timestamp - 10),
        ])->assertSessionHasErrors('email');

        $this->assertDatabaseCount('contact_messages', 0);
    }
}
