<?php

namespace Tests\Feature;

use App\Models\Shift;
use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Curated shift NAME per user: assign, filter, and (crucially) delete-clears —
 * the whole point of moving off the resurrecting free-text pattern.
 */
class ShiftTest extends TestCase
{
    use RefreshDatabase;

    private function admin(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'super_admin', 'permissions' => []], $overrides));
    }

    private function clockInToday(User $user): void
    {
        TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => 'clock_in',
            'action_timestamp' => now('Asia/Karachi'),
            'action_date' => now('Asia/Karachi')->toDateString(),
            'action_time' => now('Asia/Karachi')->toTimeString(),
        ]);
    }

    public function test_migration_seeds_the_four_default_shifts_in_order(): void
    {
        $this->assertSame(['Morning', 'Noon', 'Evening', 'Night'], Shift::orderBy('sort_order')->pluck('name')->all());
    }

    public function test_admin_can_add_a_shift_and_reject_a_duplicate(): void
    {
        $admin = $this->admin();
        $this->actingAs($admin)->post(route('users.shifts.store'), ['name' => 'Graveyard'])->assertRedirect();
        $this->assertDatabaseHas('shifts', ['name' => 'Graveyard']);

        // Case-insensitive duplicate rejected.
        $this->actingAs($admin)->post(route('users.shifts.store'), ['name' => 'graveyard'])
            ->assertSessionHasErrors('name');
    }

    public function test_deleting_a_shift_clears_it_from_everyone_who_had_it(): void
    {
        $admin = $this->admin();
        $shift = Shift::where('name', 'Morning')->first();
        $a = User::factory()->create(['shift_id' => $shift->id]);
        $b = User::factory()->create(['shift_id' => $shift->id]);

        $this->actingAs($admin)->delete(route('users.shifts.destroy', $shift->id))->assertRedirect();

        $this->assertDatabaseMissing('shifts', ['id' => $shift->id]);
        $this->assertNull($a->fresh()->shift_id);
        $this->assertNull($b->fresh()->shift_id);
    }

    public function test_store_persists_shift_id_and_update_rejects_an_invalid_one(): void
    {
        $admin = $this->admin();
        $shift = Shift::where('name', 'Evening')->first();

        $this->actingAs($admin)->post(route('users.store'), [
            'name' => 'New Person', 'email' => 'np@example.com',
            'password' => 'longenoughpassword12', 'shift_id' => $shift->id,
        ])->assertRedirect();
        $user = User::where('email', 'np@example.com')->first();
        $this->assertSame($shift->id, $user->shift_id);

        $this->actingAs($admin)->from(route('users.edit', $user))->patch(route('users.update', $user), [
            'name' => 'New Person', 'email' => 'np@example.com', 'shift_id' => 999999,
        ])->assertSessionHasErrors('shift_id');
    }

    public function test_dashboard_summary_and_board_filter_and_group_by_shift(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-07-06 12:00', 'Asia/Karachi'));
        $admin = $this->admin(['tracks_time' => false]);
        $morning = Shift::where('name', 'Morning')->first();
        $evening = Shift::where('name', 'Evening')->first();

        $a = User::factory()->create(['tracks_time' => true, 'shift_id' => $morning->id, 'shift_start_time' => '09:00:00']);
        $b = User::factory()->create(['tracks_time' => true, 'shift_id' => $evening->id, 'shift_start_time' => '16:00:00']);
        // A tracking session today guarantees each row is visible on the summary.
        foreach ([$a, $b] as $emp) {
            TrackingSession::create([
                'user_id' => $emp->id, 'client_uuid' => 'u-'.$emp->id,
                'started_at' => now()->subHour(), 'stopped_at' => now(),
                'total_seconds' => 3600, 'status' => TrackingSession::STATUS_STOPPED, 'source' => 'desktop',
            ]);
        }

        // Filter to Morning only → just $a.
        $filtered = $this->actingAs($admin)->getJson('/time-entries/today-summary?shift_ids[]='.$morning->id)->assertOk();
        $ids = collect($filtered->json('employees'))->pluck('user_id')->all();
        $this->assertContains($a->id, $ids);
        $this->assertNotContains($b->id, $ids);

        // Unfiltered board groups under the assigned shift NAMES.
        $board = $this->actingAs($admin)->getJson('/time-entries/today-summary')->assertOk()->json('shift_board');
        $labels = collect($board['bands'])->pluck('label')->all();
        $this->assertContains('Morning', $labels);
        $this->assertContains('Evening', $labels);

        Carbon::setTestNow();
    }
}
