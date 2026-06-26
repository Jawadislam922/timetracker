<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\UserShiftOverride;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The clock and the tracker must stay consistent (you can't track without being
 * clocked in), forgotten clock-outs close at shift end + a buffer, and a one-day
 * shift override flows through every shift consumer.
 */
class AttendanceConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeSession(User $user, Carbon $startedAt, string $status = 'active'): TrackingSession
    {
        return TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-'.uniqid(),
            'started_at' => $startedAt,
            'last_heartbeat_at' => $startedAt,
            'status' => $status,
            'source' => 'desktop',
        ]);
    }

    private function makeEntry(User $user, string $type, Carbon $at): TimeEntry
    {
        return TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => $type,
            'action_timestamp' => $at,
            'action_date' => $user->attendanceDateFor($at),
            'action_time' => $at->toTimeString(),
        ]);
    }

    // ---- Part A: tracking implies clocked-in -------------------------------

    public function test_heartbeat_clocks_in_a_tracker_with_no_clock_in(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 11:00:00', 'Asia/Karachi'));
        $user = User::factory()->create();
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 10:45:00', 'Asia/Karachi'));

        Sanctum::actingAs($user, ['desktop-tracker']);
        $this->patchJson("/api/desktop/sessions/{$session->id}/heartbeat", [
            'total_seconds' => 900,
            'activity_percent' => 50,
        ])->assertOk();

        $clockIn = TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_in')->first();
        $this->assertNotNull($clockIn, 'Tracking with no clock-in must open one.');
        $this->assertSame('10:45:00', Carbon::parse($clockIn->action_timestamp)->format('H:i:s'));
    }

    public function test_heartbeat_stops_tracker_after_clock_out_during_session(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 17:00:00', 'Asia/Karachi'));
        $user = User::factory()->create();
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        // Clocked out (e.g. on the web) while the desktop kept running.
        $this->makeEntry($user, 'clock_out', Carbon::parse('2026-06-26 16:55:00', 'Asia/Karachi'));

        Sanctum::actingAs($user, ['desktop-tracker']);
        $this->patchJson("/api/desktop/sessions/{$session->id}/heartbeat", [
            'total_seconds' => 1000,
            'activity_percent' => 50,
        ])->assertStatus(409)->assertJsonPath('stopped_elsewhere', true);

        $this->assertSame('stopped', $session->fresh()->status);
        // No phantom re-clock-in was created.
        $this->assertSame(1, TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_in')->count());
    }

    public function test_start_after_same_day_clock_out_is_refused_not_reopened(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 17:05:00', 'Asia/Karachi'));
        $user = User::factory()->create();
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $this->makeEntry($user, 'clock_out', Carbon::parse('2026-06-26 17:00:00', 'Asia/Karachi'));

        Sanctum::actingAs($user, ['desktop-tracker']);
        $this->postJson('/api/desktop/sessions/start', [
            'client_uuid' => 'after-out-'.uniqid(),
            'started_at' => now()->toIso8601String(),
        ])->assertStatus(409)->assertJsonPath('stopped_elsewhere', true);

        // No phantom second clock-in re-opening the closed day; no session left.
        $this->assertSame(1, TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_in')->count());
        $this->assertSame(0, TrackingSession::where('user_id', $user->id)->count());
    }

    public function test_heartbeat_on_session_started_after_clock_out_stops_without_phantom(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 17:10:00', 'Asia/Karachi'));
        $user = User::factory()->create();
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $this->makeEntry($user, 'clock_out', Carbon::parse('2026-06-26 17:00:00', 'Asia/Karachi'));
        // A session that began AFTER the clock-out — the bug's exact shape.
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 17:05:00', 'Asia/Karachi'));

        Sanctum::actingAs($user, ['desktop-tracker']);
        $this->patchJson("/api/desktop/sessions/{$session->id}/heartbeat", [
            'total_seconds' => 300, 'activity_percent' => 50,
        ])->assertStatus(409);

        $this->assertSame('stopped', $session->fresh()->status);
        $this->assertSame(1, TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_in')->count());
    }

    public function test_new_day_session_after_prior_day_clock_out_auto_clocks_in(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 09:05:00', 'Asia/Karachi'));
        $user = User::factory()->create();
        // Yesterday's day was properly closed.
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-25 09:00:00', 'Asia/Karachi'));
        $this->makeEntry($user, 'clock_out', Carbon::parse('2026-06-25 17:00:00', 'Asia/Karachi'));
        // A fresh session today with no clock-in yet → auto clock-in (cover orphan).
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));

        Sanctum::actingAs($user, ['desktop-tracker']);
        $this->patchJson("/api/desktop/sessions/{$session->id}/heartbeat", [
            'total_seconds' => 300, 'activity_percent' => 50,
        ])->assertOk();

        $latest = TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_in')
            ->orderByDesc('action_timestamp')->orderByDesc('id')->first();
        $this->assertSame('Auto clock-in (started tracker)', $latest->notes);
        $this->assertSame('2026-06-26', Carbon::parse($latest->action_timestamp)->setTimezone('Asia/Karachi')->format('Y-m-d'));
    }

    // ---- Part A2 + B: auto-close --------------------------------------------

    public function test_auto_close_closes_forgotten_clock_in_at_shift_end_plus_buffer(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 19:00:00', 'Asia/Karachi'));
        $user = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));

        $this->artisan('attendance:auto-clock-out', ['--user' => $user->id, '--buffer-minutes' => 20])
            ->assertExitCode(0);

        $clockOut = TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_out')->first();
        $this->assertNotNull($clockOut);
        // Shift ends 17:00, + 20m buffer = 17:20.
        $this->assertSame('17:20:00', Carbon::parse($clockOut->action_timestamp)->setTimezone('Asia/Karachi')->format('H:i:s'));
    }

    public function test_auto_close_stops_the_active_tracker_too(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 19:00:00', 'Asia/Karachi'));
        $user = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        // Tracker quiet since 10:00 (well past idle window), so it's a forgotten day.
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $session->update(['last_heartbeat_at' => Carbon::parse('2026-06-26 10:00:00', 'Asia/Karachi')]);

        $this->artisan('attendance:auto-clock-out', ['--user' => $user->id, '--buffer-minutes' => 20])
            ->assertExitCode(0);

        $this->assertDatabaseHas('time_entries', ['user_id' => $user->id, 'action_type' => 'clock_out']);
        $this->assertSame('stopped', $session->fresh()->status);
    }

    public function test_auto_close_leaves_actively_tracking_overtime_alone(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 19:00:00', 'Asia/Karachi'));
        $user = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        // Tracker is live right now (heartbeat 5 min ago) → genuine overtime.
        $session = $this->makeSession($user, Carbon::parse('2026-06-26 09:00:00', 'Asia/Karachi'));
        $session->update(['last_heartbeat_at' => Carbon::parse('2026-06-26 18:55:00', 'Asia/Karachi')]);

        $this->artisan('attendance:auto-clock-out', ['--user' => $user->id, '--buffer-minutes' => 20])
            ->assertExitCode(0);

        $this->assertDatabaseMissing('time_entries', ['user_id' => $user->id, 'action_type' => 'clock_out']);
    }

    // ---- Part C: per-day shift override -------------------------------------

    public function test_effective_shift_uses_override_for_the_day(): void
    {
        $user = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        UserShiftOverride::create([
            'user_id' => $user->id,
            'date' => '2026-06-26',
            'shift_start_time' => '08:00',
            'shift_hours' => 6,
        ]);

        $standing = $user->effectiveShiftFor('2026-06-25');
        $this->assertSame('09:00', $standing['start_time']->format('H:i'));
        $this->assertSame(8.0, $standing['hours']);

        $overridden = $user->fresh()->effectiveShiftFor('2026-06-26');
        $this->assertSame('08:00', $overridden['start_time']->format('H:i'));
        $this->assertSame(6.0, $overridden['hours']);
    }

    public function test_override_shortens_the_auto_close_window(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-26 16:00:00', 'Asia/Karachi'));
        $user = User::factory()->create(['shift_start_time' => '09:00', 'shift_hours' => 8]);
        // One-day change: 08:00 for 6h → shift ends 14:00, closes 14:20.
        UserShiftOverride::create([
            'user_id' => $user->id, 'date' => '2026-06-26',
            'shift_start_time' => '08:00', 'shift_hours' => 6,
        ]);
        $this->makeEntry($user, 'clock_in', Carbon::parse('2026-06-26 08:00:00', 'Asia/Karachi'));

        $this->artisan('attendance:auto-clock-out', ['--user' => $user->id, '--buffer-minutes' => 20])
            ->assertExitCode(0);

        $clockOut = TimeEntry::where('user_id', $user->id)->where('action_type', 'clock_out')->first();
        $this->assertSame('14:20:00', Carbon::parse($clockOut->action_timestamp)->setTimezone('Asia/Karachi')->format('H:i:s'));
    }

    public function test_member_with_permission_can_set_future_override(): void
    {
        $user = User::factory()->create([
            'role' => 'member',
            'permissions' => ['shift.edit_own'],
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->from('/my-schedule')
            ->post('/shift-overrides', [
                'date' => Carbon::tomorrow('Asia/Karachi')->toDateString(),
                'shift_start_time' => '08:00',
                'shift_hours' => 6,
                'reason' => 'Off Saturday',
            ])
            ->assertRedirect()
            ->assertSessionHas('success');

        $this->assertDatabaseHas('user_shift_overrides', [
            'user_id' => $user->id,
            'shift_hours' => 6.00,
        ]);
        $this->assertDatabaseHas('tracking_audit_logs', [
            'subject_user_id' => $user->id,
            'actor_user_id' => $user->id,
            'action' => 'shift.override',
        ]);
    }

    public function test_member_cannot_backdate_their_own_override(): void
    {
        $user = User::factory()->create([
            'role' => 'member',
            'permissions' => ['shift.edit_own'],
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->from('/my-schedule')
            ->post('/shift-overrides', [
                'date' => Carbon::yesterday('Asia/Karachi')->toDateString(),
                'shift_start_time' => '08:00',
                'shift_hours' => 6,
            ])
            ->assertSessionHasErrors('date');

        $this->assertSame(0, UserShiftOverride::count());
    }

    public function test_member_without_permission_is_forbidden(): void
    {
        $user = User::factory()->create([
            'role' => 'member',
            'permissions' => [],
            'email_verified_at' => now(),
        ]);

        $this->actingAs($user)
            ->post('/shift-overrides', [
                'date' => Carbon::tomorrow('Asia/Karachi')->toDateString(),
                'shift_start_time' => '08:00',
                'shift_hours' => 6,
            ])
            ->assertForbidden();
    }
}
