<?php

namespace Tests\Feature;

use App\Models\Client;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A manual work_hour's work_type constrains which client it may attach to:
 * tracker/manual → a 'tracker_manual' client, fixed → 'fixed',
 * outside_of_upwork → 'outside_of_upwork'. The Edit form used to skip the
 * client filtering that Create enforces, so an incompatible combo could be
 * saved through Edit. The server now rejects it on BOTH store() and update().
 */
class WorkHourClientWorkTypeTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $over = []): array
    {
        return array_merge([
            'date' => '2026-06-23',
            'hours' => 3,
            'minutes' => 0,
            'description' => 'manual entry',
            'work_type' => 'manual',
            'client_id' => null,
            'tracker' => null,
        ], $over);
    }

    public function test_store_rejects_a_client_whose_work_type_mismatches(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin']);
        $fixedClient = Client::create(['name' => 'Fixed Co', 'work_type' => 'fixed']);

        // work_type 'tracker' expects a 'tracker_manual' client, not a 'fixed' one.
        $this->actingAs($admin)
            ->post(route('work-hours.store'), $this->payload([
                'work_type' => 'tracker', 'client_id' => $fixedClient->id,
            ]))
            ->assertSessionHasErrors('client_id');

        $this->assertDatabaseMissing('work_hours', [
            'work_type' => 'tracker', 'client_id' => $fixedClient->id,
        ]);
    }

    public function test_update_rejects_a_client_whose_work_type_mismatches(): void
    {
        $user = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $fixedClient = Client::create(['name' => 'Fixed Co', 'work_type' => 'fixed']);
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-23', 'hours' => 2.0,
            'description' => 'Manual entry', 'work_type' => 'manual', 'source' => 'manual',
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload([
                'work_type' => 'tracker', 'client_id' => $fixedClient->id,
            ]))
            ->assertSessionHasErrors('client_id');

        $this->assertSame('manual', $wh->fresh()->work_type, 'the bad combo must not persist');
    }

    public function test_update_accepts_a_client_whose_work_type_matches(): void
    {
        $user = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $fixedClient = Client::create(['name' => 'Fixed Co', 'work_type' => 'fixed']);
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-23', 'hours' => 2.0,
            'description' => 'Manual entry', 'work_type' => 'manual', 'source' => 'manual',
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload([
                'work_type' => 'fixed', 'client_id' => $fixedClient->id, 'hours' => 4,
            ]))
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $fresh = $wh->fresh();
        $this->assertSame('fixed', $fresh->work_type);
        $this->assertEquals($fixedClient->id, $fresh->client_id);
    }
}
