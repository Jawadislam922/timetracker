<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use App\Support\AttendanceHours;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The app must survive the window between a deploy and its migration.
 *
 * Hostinger pulls code automatically but migrations are run by hand, so for a
 * few minutes the shift-history resolver exists while its table does not.
 * Querying it then would 500 every authenticated page — which is exactly what
 * happened on the deploy this guard was written for.
 */
class ShiftHistoryGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_still_works_when_the_history_table_is_missing(): void
    {
        $user = User::factory()->create([
            'shift_start_time' => '09:00',
            'shift_grace_minutes' => 15,
            'work_timezone' => 'Asia/Karachi',
        ]);

        $ts = Carbon::parse('2026-08-10 09:30:00', 'Asia/Karachi');
        $entry = TimeEntry::create([
            'user_id' => $user->id, 'action_type' => 'clock_in',
            'action_timestamp' => $ts, 'action_date' => $ts->toDateString(),
            'action_time' => $ts->format('H:i:s'),
        ]);

        // Simulate the pre-migration production state.
        Schema::drop('user_shift_assignments');
        User::forgetShiftHistoryAvailability();

        $this->assertFalse(User::shiftHistoryAvailable(), 'guard sees the table is gone');
        $this->assertSame(['shiftOverrides'], User::shiftEagerLoads(), 'the missing relation is not eager-loaded');

        // The resolver falls back to the user columns instead of exploding.
        $shift = $user->effectiveShiftFor('2026-08-10');
        $this->assertSame('09:00', $shift['start_time']->format('H:i'));
        $this->assertSame(15, $shift['grace_minutes']);

        $this->assertTrue(
            AttendanceHours::isLateClockIn($user, Carbon::parse('2026-08-10', 'Asia/Karachi'), $entry),
            'late detection still works with no history table'
        );

        // And the dashboard — the page that eager-loads shift relations — renders.
        $this->actingAs($user)->get(route('dashboard'))->assertOk();
    }

}
