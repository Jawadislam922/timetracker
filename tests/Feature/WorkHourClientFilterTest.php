<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The client filter must select ONE client, not everyone sharing a name.
 *
 * Production has duplicate client names ("Brad Pugh" x3), and the old
 * name-based filter silently mixed all of their hours into one report — the
 * "irrelevant clients" bug the owner hit. Filtering is by client ID now, with
 * legacy name values still accepted so old bookmarked URLs keep working.
 */
class WorkHourClientFilterTest extends TestCase
{
    use RefreshDatabase;

    private function reportFor(User $admin, array $params = [])
    {
        return $this->actingAs($admin)->get(route('work-hours.report', $params));
    }

    public function test_filtering_by_id_returns_only_that_clients_hours_even_with_a_name_twin(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $worker = User::factory()->create();

        // Two different clients with the SAME name — the production situation.
        $bradA = Client::create(['name' => 'Brad Pugh', 'work_type' => 'fixed']);
        $bradB = Client::create(['name' => 'Brad Pugh', 'work_type' => 'fixed']);

        WorkHour::create([
            'user_id' => $worker->id, 'client_id' => $bradA->id, 'date' => '2026-08-01',
            'hours' => 2.0, 'description' => 'work for the REAL brad',
            'work_type' => 'fixed', 'source' => 'manual',
        ]);
        WorkHour::create([
            'user_id' => $worker->id, 'client_id' => $bradB->id, 'date' => '2026-08-01',
            'hours' => 3.0, 'description' => 'work for the OTHER brad',
            'work_type' => 'fixed', 'source' => 'manual',
        ]);

        $this->reportFor($admin, ['clients' => [(string) $bradA->id]])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('workHours.total', 1)
                ->where('workHours.data.0.client.id', $bradA->id)
            );
    }

    public function test_legacy_name_values_still_filter(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $worker = User::factory()->create();

        $client = Client::create(['name' => 'Acme Corp', 'work_type' => 'fixed']);
        $other = Client::create(['name' => 'Other LLC', 'work_type' => 'fixed']);
        WorkHour::create(['user_id' => $worker->id, 'client_id' => $client->id, 'date' => '2026-08-01', 'hours' => 1.0, 'description' => 'acme work', 'work_type' => 'fixed', 'source' => 'manual']);
        WorkHour::create(['user_id' => $worker->id, 'client_id' => $other->id, 'date' => '2026-08-01', 'hours' => 1.0, 'description' => 'other work', 'work_type' => 'fixed', 'source' => 'manual']);

        // Old bookmarked URLs carry names, not ids — they must keep working.
        $this->reportFor($admin, ['clients' => ['Acme Corp']])
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('workHours.total', 1)
                ->where('workHours.data.0.client.name', 'Acme Corp')
            );
    }

    /** Archived (finished-contract) clients stay out of the report dropdown. */
    public function test_archived_clients_are_excluded_from_the_options(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $worker = User::factory()->create();

        $live = Client::create(['name' => 'Live Co', 'work_type' => 'fixed', 'is_active' => true]);
        $gone = Client::create(['name' => 'Gone LLC', 'work_type' => 'fixed', 'is_active' => false]);
        WorkHour::create(['user_id' => $worker->id, 'client_id' => $live->id, 'date' => '2026-08-01', 'hours' => 1.0, 'description' => 'live work', 'work_type' => 'fixed', 'source' => 'manual']);
        WorkHour::create(['user_id' => $worker->id, 'client_id' => $gone->id, 'date' => '2026-08-01', 'hours' => 1.0, 'description' => 'old work', 'work_type' => 'fixed', 'source' => 'manual']);

        $this->reportFor($admin)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->has('filterOptions.clients', 1)
                ->where('filterOptions.clients.0.name', 'Live Co')
            );
    }

    public function test_client_options_are_id_name_pairs(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $worker = User::factory()->create();
        $client = Client::create(['name' => 'Acme Corp', 'work_type' => 'fixed']);
        WorkHour::create(['user_id' => $worker->id, 'client_id' => $client->id, 'date' => '2026-08-01', 'hours' => 1.0, 'description' => 'acme work', 'work_type' => 'fixed', 'source' => 'manual']);

        $this->reportFor($admin)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filterOptions.clients.0.id', $client->id)
                ->where('filterOptions.clients.0.name', 'Acme Corp')
            );
    }
}
