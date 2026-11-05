<?php

namespace Tests\Feature;

use App\Models\ContactMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public contact form must do a REAL 302 with the #form anchor (the old
 * implementation concatenated the RedirectResponse to a string, which returns
 * its serialized body as a 200 and loses both the status and the fragment).
 */
class ContactFormTest extends TestCase
{
    use RefreshDatabase;

    public function test_contact_form_stores_the_message_and_redirects_with_anchor(): void
    {
        // Honeypot fields required by the spam middleware: empty website trap
        // + a form_loaded_at timestamp older than the 2-second trap.
        $response = $this->post('/contact', [
            'name' => 'Amina',
            'email' => 'amina@example.com',
            'message' => 'The biryani time was spot on, thank you.',
            'website' => '',
            'form_loaded_at' => (string) (now()->timestamp - 10),
        ]);

        $response->assertRedirect();
        $location = (string) $response->headers->get('Location');
        $this->assertStringContainsString('/contact', $location);
        $this->assertStringContainsString('sent=1', $location);
        $this->assertStringContainsString('#form', $location);

        $this->assertDatabaseCount('contact_messages', 1);
        $stored = ContactMessage::sole();
        $this->assertSame('amina@example.com', $stored->email);
        $this->assertStringContainsString('biryani', (string) $stored->message);
    }

    public function test_contact_form_rejects_an_invalid_email(): void
    {
        $this->post('/contact', [
            'email' => 'not-an-email',
            'message' => 'This should not be stored.',
            'website' => '',
            'form_loaded_at' => (string) (now()->timestamp - 10),
        ])->assertSessionHasErrors('email');

        $this->assertDatabaseCount('contact_messages', 0);
    }
}
