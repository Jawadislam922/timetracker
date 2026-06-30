<?php

namespace Tests\Feature;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\UserShiftOverride;
use App\Models\WorkHour;
use App\Support\AttendanceHours;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Broad pre-deploy verification: auto-close math across shift shapes, the simple
 * hours manual entry, in-office derivation, the full clock+tracker flow, and the
 * one-day shift override's effect on late detection.
 */
class AttendanceComprehensiveTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function clockIn(User $u, string $at): TimeEntry
    {
        $ts = Carbon::parse($at, 'Asia/Karachi');

        return TimeEntry::create([
            'user_id' => $u->id, 'action_type' => 'clock_in',
            'action_timestamp' => $ts, 'action_date' => $u->attendanceDateFor($ts),
            'action_time' => $ts->toTimeString(),
        ]);
    }

    private function makeSession(User $u, string $start, string $lastBeat, string $status = 'active'): TrackingSession
    {
        return TrackingSession::create([
            'user_id' => $u->id, 'client_uuid' => 'u-'.uniqid(),
            'started_at' => Carbon::parse($start, 'Asia/Karachi'),
            'last_heartbeat_at' => Carbon::parse($lastBeat, 'Asia/Karachi'),
            'status' => $status, 'source' => 'desktop',
        ]);
    }

    private function autoCloseAt(User $u, string $now): ?TimeEntry
    {
        Carbon::setTestNow(Carbon::parse($now, 'Asia/Karachi'));
        $this->artisan('attendance:auto-clock-out', ['--user' => $u->id, '--buffer-minutes' => 20])->assertExitCode(0);

        return TimeEntry::where('user_id', $u->id)->where('action_type', 'clock_out')->first();
    }

    private function closeTime(?TimeEntry $clockOut): ?string
    {
        return $clockOut ? Carbon::parse($clockOut->action_timestamp)->setTimezone('Asia/Karachi')->format('Y-m-d H:i:s') : null;
    }

    // ---- Auto-close across shift shapes -------------------------------------

    public function test_late_clock_in_still_closes_at_shift_end_not_a_full_shift_later(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 11:00:00'); // 2h late
        $out = $this->autoCloseAt($u, '2026-06-26 19:00:00');
        // Shift end 17:00 + 20m = 17:20 (NOT 11:00 + 8h).
        $this->assertSame('2026-06-26 17:20:00', $this->closeTime($out));
    }

    public function test_night_shift_closes_next_morning(): void
    {
        $u = User::factory()->create(['shift_start_time' => '22:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 22:00:00');
        $out = $this->autoCloseAt($u, '2026-06-27 08:00:00');
        // 22:00 + 8h = 06:00 next day, + 20m = 06:20.
        $this->assertSame('2026-06-27 06:20:00', $this->closeTime($out));
    }

    public function test_no_shift_configured_falls_back_to_default_hours(): void
    {
        $u = User::factory()->create(['shift_start_time' => null, 'shift_hours' => null]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        // Default prompt_after_hours = 8 → 09:00 + 8h + 20m = 17:20.
        $out = $this->autoCloseAt($u, '2026-06-26 20:00:00');
        $this->assertSame('2026-06-26 17:20:00', $this->closeTime($out));
    }

    public function test_session_resumed_after_break_then_forgotten_is_auto_closed(): void
    {
        // Resumed from a break (break_end is the latest action) then forgot to
        // clock out — the auto-close cap must still recognise this as an open
        // session and close it at shift end + buffer (previously break_end was
        // not treated as open, so it was never closed).
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        foreach ([['break_start', '12:00:00'], ['break_end', '12:30:00']] as [$type, $t]) {
            $ts = Carbon::parse("2026-06-26 {$t}", 'Asia/Karachi');
            TimeEntry::create([
                'user_id' => $u->id, 'action_type' => $type,
                'action_timestamp' => $ts, 'action_date' => $u->attendanceDateFor($ts),
                'action_time' => $ts->toTimeString(),
            ]);
        }

        $out = $this->autoCloseAt($u, '2026-06-26 20:00:00');
        $this->assertNotNull($out, 'a break_end-terminal open session must be auto-closed');
        $this->assertSame('2026-06-26 17:20:00', $this->closeTime($out)); // 17:00 + 20m buffer
    }

    public function test_tracked_overtime_is_credited_to_last_activity(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        // Worked past shift; tracker last beat 19:30, now 22:00 (quiet > idle window).
        $this->makeSession($u, '2026-06-26 09:00:00', '2026-06-26 19:30:00');
        $out = $this->autoCloseAt($u, '2026-06-26 22:00:00');
        // Credited to real activity (19:30), not cut back to 17:20.
        $this->assertSame('2026-06-26 19:30:00', $this->closeTime($out));
    }

    public function test_actively_tracking_overtime_is_left_open(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        // Tracker live now (beat 5 min ago) → still working, don't close.
        $this->makeSession($u, '2026-06-26 09:00:00', '2026-06-26 18:55:00');
        $out = $this->autoCloseAt($u, '2026-06-26 19:00:00');
        $this->assertNull($out);
    }

    public function test_hard_cap_closes_an_always_on_tracker(): void
    {
        $u = User::factory()->create(['shift_start_time' => '06:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 06:00:00');
        // Tracker never goes quiet; now 17h later — past the 16h hard cap.
        $this->makeSession($u, '2026-06-26 06:00:00', '2026-06-26 22:50:00');
        $out = $this->autoCloseAt($u, '2026-06-26 23:00:00');
        // 06:00 + 16h hard cap = 22:00.
        $this->assertSame('2026-06-26 22:00:00', $this->closeTime($out));
    }

    public function test_not_closed_before_the_shift_is_over(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        // Only 14:00 now — shift+buffer (17:20) not reached.
        $out = $this->autoCloseAt($u, '2026-06-26 14:00:00');
        $this->assertNull($out);
    }

    // ---- In-office derivation reflects the close ----------------------------

    public function test_in_office_hours_reflect_the_bounded_close(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->clockIn($u, '2026-06-26 09:00:00');
        $this->autoCloseAt($u, '2026-06-26 19:00:00'); // closes 17:20

        $entries = TimeEntry::where('user_id', $u->id)
            ->orderBy('action_timestamp')->orderBy('id')->get();
        $hours = AttendanceHours::dayInOfficeHours($entries);
        // 09:00 → 17:20 = 8h20m ≈ 8.33h, NOT 10h (now) or 12h (old cap).
        $this->assertEqualsWithDelta(8.333, $hours, 0.02);
    }

    // ---- Simple hours manual entry ------------------------------------------

    public function test_member_creates_simple_hours_manual_entry(): void
    {
        MonitoringSetting::current()->update(['allow_offline_time' => true]);
        $u = User::factory()->create(['role' => 'member', 'permissions' => [], 'email_verified_at' => now()]);

        $this->actingAs($u)->from('/work-hours/create')->post('/work-hours', [
            'date' => '2026-06-26',
            'hours' => 2,
            'minutes' => 30,
            'description' => 'Offline planning',
            'work_type' => 'office_work',
        ])->assertRedirect();

        $wh = WorkHour::where('user_id', $u->id)->first();
        $this->assertNotNull($wh);
        $this->assertSame('manual', $wh->source);
        $this->assertEqualsWithDelta(2.5, (float) $wh->hours, 0.001);
    }

    public function test_zero_time_manual_entry_is_rejected(): void
    {
        MonitoringSetting::current()->update(['allow_offline_time' => true]);
        $u = User::factory()->create(['role' => 'member', 'permissions' => [], 'email_verified_at' => now()]);

        $this->actingAs($u)->from('/work-hours/create')->post('/work-hours', [
            'date' => '2026-06-26', 'hours' => 0, 'minutes' => 0,
            'description' => 'nothing', 'work_type' => 'office_work',
        ])->assertSessionHasErrors('hours');

        $this->assertSame(0, WorkHour::where('user_id', $u->id)->count());
    }

    public function test_tracker_recorded_hours_stay_locked_on_update(): void
    {
        $u = User::factory()->create(['email_verified_at' => now()]);
        $wh = WorkHour::create([
            'user_id' => $u->id, 'date' => '2026-06-26', 'hours' => 3.5,
            'description' => 'tracked', 'work_type' => 'tracker', 'source' => 'tracker',
        ]);

        $this->actingAs($u)->from('/work-hours')->put("/work-hours/{$wh->id}", [
            'date' => '2026-06-26', 'hours' => 9, 'minutes' => 0,
            'description' => 'tracked edited', 'work_type' => 'tracker',
        ])->assertRedirect();

        // Hours unchanged (locked); description may update.
        $this->assertEqualsWithDelta(3.5, (float) $wh->fresh()->hours, 0.001);
    }

    // ---- Full clock + tracker flow ------------------------------------------

    public function test_normal_clock_in_then_track_keeps_a_single_clock_in(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $u = User::factory()->create();
        $this->clockIn($u, '2026-06-26 09:00:00');

        \Laravel\Sanctum\Sanctum::actingAs($u, ['desktop-tracker']);
        $start = $this->postJson('/api/desktop/sessions/start', [
            'client_uuid' => 'flow-1', 'started_at' => now()->toIso8601String(),
        ])->assertStatus(201);
        $this->patchJson("/api/desktop/sessions/{$start->json('id')}/heartbeat", [
            'total_seconds' => 300, 'activity_percent' => 50,
        ])->assertOk();

        // Already clocked in → start/heartbeat must NOT add another clock-in.
        $this->assertSame(1, TimeEntry::where('user_id', $u->id)->where('action_type', 'clock_in')->count());
    }

    // ---- Shift override effect on late detection ----------------------------

    public function test_one_day_override_prevents_a_late_flag(): void
    {
        $u = User::factory()->create(['shift_start_time' => '09:00', 'shift_grace_minutes' => 0, 'shift_hours' => 8]);
        UserShiftOverride::create(['user_id' => $u->id, 'date' => '2026-06-26', 'shift_start_time' => '11:00']);

        $clockIn = $this->clockIn($u, '2026-06-26 10:30:00');
        $date = Carbon::parse('2026-06-26', 'Asia/Karachi');

        // 10:30 is late vs the 09:00 standing shift, but on time vs the 11:00 override.
        $this->assertTrue(AttendanceHours::isLateClockIn($u->fresh(), $date->copy(), $clockIn) === false);

        // Sanity: without the override the same punch IS late.
        $u2 = User::factory()->create(['shift_start_time' => '09:00', 'shift_grace_minutes' => 0]);
        $clockIn2 = $this->clockIn($u2, '2026-06-26 10:30:00');
        $this->assertTrue(AttendanceHours::isLateClockIn($u2, $date->copy(), $clockIn2));
    }
}
