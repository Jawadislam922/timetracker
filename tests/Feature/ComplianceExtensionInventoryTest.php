<?php

namespace Tests\Feature;

use App\Models\MachineReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The Compliance page groups extensions across the team: one row per distinct
 * extension with the count of people who have it, flagged ones first — so
 * "Instant Data Scraper is on 3 machines" is one click to the names.
 */
class ComplianceExtensionInventoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_extensions_are_grouped_across_people_with_flagged_first(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $a = User::factory()->create(['name' => 'Hanif Khan']);
        $b = User::factory()->create(['name' => 'Sana Khan']);

        foreach ([[$a, 'PC-1'], [$b, 'PC-2']] as [$u, $dev]) {
            MachineReport::create([
                'user_id' => $u->id, 'device_name' => $dev, 'kind' => 'extensions', 'collected_at' => now(),
                'items' => [
                    ['name' => 'Instant Data Scraper', 'browser' => 'Chrome', 'enabled' => true],
                    ['name' => 'uBlock Origin', 'browser' => 'Chrome', 'enabled' => true],
                ],
                'item_count' => 2, 'flagged_count' => 1,
            ]);
        }

        $this->actingAs($admin)->get('/monitoring/compliance')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Monitoring/Compliance')
                ->has('extensions', 2)
                ->where('extensions.0.name', 'Instant Data Scraper') // flagged sorts first
                ->where('extensions.0.flagged', true)
                ->where('extensions.0.people', 2)                     // both Hanif + Sana
                ->where('extensions.1.name', 'uBlock Origin')
                ->where('extensions.1.flagged', false)
            );
    }
}
