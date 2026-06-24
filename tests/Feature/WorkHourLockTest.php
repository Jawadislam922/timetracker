<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use App\Models\WorkHour;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tracker-recorded work_hours have LOCKED hours — an employee can't edit a
 * tracked entry to show more (or different) hours than the desktop measured.
 * Description still updates; manual entries stay fully editable.
 */
class WorkHourLockTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $over = []): array
    {
        return array_merge([
            'date' => '2026-06-23',
            'hours' => 8,
            'minutes' => 0,
            'description' => 'edited description',
            'work_type' => 'manual',
            'client_id' => null,
            'tracker' => null,
        ], $over);
    }

    public function test_tracked_entry_hours_are_locked_but_description_updates(): void
    {
        $user = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $session = TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-lock',
            'started_at' => now()->subHours(4), 'stopped_at' => now(),
            'total_seconds' => 12250, 'status' => 'stopped', 'source' => 'desktop',
        ]);
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-23', 'hours' => 3.4,
            'description' => 'Tracked via desktop', 'work_type' => 'tracker',
            'source' => 'tracker', 'tracking_session_id' => $session->id,
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload(['hours' => 8]))
            ->assertRedirect();

        $fresh = $wh->fresh();
        $this->assertEqualsWithDelta(3.4, (float) $fresh->hours, 0.001, 'tracked hours must NOT change');
        $this->assertSame('edited description', $fresh->description, 'description should still update');
    }

    public function test_manual_entry_hours_remain_editable(): void
    {
        $user = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-23', 'hours' => 2.0,
            'description' => 'Manual entry', 'work_type' => 'manual', 'source' => 'manual',
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload(['hours' => 5]))
            ->assertRedirect();

        $this->assertEqualsWithDelta(5.0, (float) $wh->fresh()->hours, 0.001, 'manual hours should update');
    }
}
