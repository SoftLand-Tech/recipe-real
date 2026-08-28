<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The public landing page (GET /): 200 with the brand + download section,
 * in the no-release state (download card reads "coming soon") — the state
 * every fresh deployment starts in.
 */
class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_application_returns_a_successful_response(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200)
            ->assertSee('RecipeReal')
            ->assertSee('Coming soon');
    }
}
