<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Inertia visits return application/json; if a browser/proxy caches that and
 * serves it to a normal navigation, the user sees raw JSON instead of the app.
 * Those responses must be no-store so they're never replayed as a document.
 */
class InertiaCachingTest extends TestCase
{
    use RefreshDatabase;

    public function test_inertia_visits_are_not_cacheable(): void
    {
        $user = User::factory()->create();

        $res = $this->actingAs($user)->withHeaders(['X-Inertia' => 'true'])->get('/dashboard');

        $this->assertStringContainsString('no-store', (string) $res->headers->get('Cache-Control'));
    }
}
