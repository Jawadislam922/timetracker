<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\UpworkProfile;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Saving a row returns the user to the exact list view they came from.
 *
 * Index pages keep page number, search and filters in the query string. Every
 * mutation therefore carries `return_to`; without it people were dumped back on
 * page 1 of an unfiltered list after every edit — brutal on a thousand-row table.
 *
 * `return_to` is user-supplied, so each case also pins that an off-site value is
 * ignored rather than followed.
 */
class ReturnPathTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
    }

    public function test_work_hour_update_returns_to_the_originating_list(): void
    {
        $admin = $this->admin();
        $entry = WorkHour::create([
            'user_id' => $admin->id, 'date' => '2026-08-01', 'hours' => 2.0,
            'description' => 'work', 'work_type' => 'manual', 'source' => 'manual',
        ]);

        $this->actingAs($admin)
            ->put(route('work-hours.update', $entry), [
                'date' => '2026-08-01', 'hours' => '3', 'minutes' => '0',
                'description' => 'work', 'work_type' => 'manual',
                'return_to' => '/work-hours?page=3&perPage=50',
            ])
            ->assertRedirect('/work-hours?page=3&perPage=50');
    }

    public function test_work_hour_update_ignores_an_offsite_return_path(): void
    {
        $admin = $this->admin();
        $entry = WorkHour::create([
            'user_id' => $admin->id, 'date' => '2026-08-01', 'hours' => 2.0,
            'description' => 'work', 'work_type' => 'manual', 'source' => 'manual',
        ]);

        $this->actingAs($admin)
            ->put(route('work-hours.update', $entry), [
                'date' => '2026-08-01', 'hours' => '3', 'minutes' => '0',
                'description' => 'work', 'work_type' => 'manual',
                'return_to' => '//evil.example.com/phish',
            ])
            ->assertRedirect(route('work-hours.index'));
    }

    public function test_upwork_profile_update_returns_to_the_filtered_list(): void
    {
        $profile = UpworkProfile::create(['name' => 'Some Profile', 'is_active' => true]);

        $this->actingAs($this->admin())
            ->put(route('upwork-profiles.update', $profile), [
                'name' => 'Renamed Profile', 'is_active' => true,
                'return_to' => '/upwork-profiles?status=archived',
            ])
            ->assertRedirect('/upwork-profiles?status=archived');
    }

    public function test_upwork_profile_store_returns_to_the_list(): void
    {
        $this->actingAs($this->admin())
            ->post(route('upwork-profiles.store'), [
                'name' => 'Brand New', 'is_active' => true,
                'return_to' => '/upwork-profiles?status=active',
            ])
            ->assertRedirect('/upwork-profiles?status=active');
    }

    public function test_client_store_returns_to_the_originating_list(): void
    {
        $this->actingAs($this->admin())
            ->post(route('clients.store'), [
                'name' => 'Fresh Client', 'work_type' => 'outside_of_upwork',
                'return_to' => '/clients?page=2&search=fre',
            ])
            ->assertRedirect('/clients?page=2&search=fre');

        $this->assertSame(1, Client::where('name', 'Fresh Client')->count());
    }
}
