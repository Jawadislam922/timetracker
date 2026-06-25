<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\WorkHour;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Manual work-hour entries are now built from clock windows that must fit the
 * user's open gaps; the parent row's hours stays the summed window duration.
 */
class WorkHourWindowsTest extends TestCase
{
    use RefreshDatabase;

    private function entry(User $u, string $type, string $date, string $time): void
    {
        $ts = Carbon::parse("$date $time", 'Asia/Karachi');
        TimeEntry::create([
            'user_id' => $u->id,
            'action_type' => $type,
            'action_timestamp' => $ts,
            'action_date' => $date,
            'action_time' => $ts->toTimeString(),
        ]);
    }

    /** A user in-office 09:00–17:00 with no breaks/tracked time. */
    private function inOfficeUser(string $date = '2026-06-20'): User
    {
        $user = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $this->entry($user, 'clock_in', $date, '09:00');
        $this->entry($user, 'clock_out', $date, '17:00');

        return $user;
    }

    private function payload(array $over = []): array
    {
        return array_merge([
            'date' => '2026-06-20',
            'description' => 'Manual work',
            'work_type' => 'manual',
            'client_id' => null,
            'tracker' => null,
        ], $over);
    }

    public function test_valid_windows_create_one_row_with_summed_hours(): void
    {
        $user = $this->inOfficeUser();

        $this->actingAs($user)
            ->post(route('work-hours.store'), $this->payload([
                'windows' => [
                    ['start_at' => '2026-06-20T10:00:00', 'end_at' => '2026-06-20T11:30:00'],
                    ['start_at' => '2026-06-20T13:00:00', 'end_at' => '2026-06-20T13:30:00'],
                ],
            ]))
            ->assertRedirect();

        $this->assertSame(1, WorkHour::where('user_id', $user->id)->count());
        $wh = WorkHour::where('user_id', $user->id)->first();
        $this->assertEqualsWithDelta(2.0, (float) $wh->hours, 0.001);
        $this->assertSame(2, $wh->windows()->count());
    }

    public function test_window_at_an_exact_sub_minute_gap_boundary_saves(): void
    {
        // A tracked session ending at 10:00:30 leaves a gap that starts at
        // 10:00:30 — the form now fills the chip with those exact seconds, so a
        // window beginning at 10:00:30 must be accepted (the old minute-rounded
        // 10:00:00 landed before the gap and was wrongly rejected).
        $user = $this->inOfficeUser();
        TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-sec',
            'started_at' => Carbon::parse('2026-06-20 09:00:00', 'Asia/Karachi'),
            'stopped_at' => Carbon::parse('2026-06-20 10:00:30', 'Asia/Karachi'),
            'total_seconds' => 3630, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        $this->actingAs($user)
            ->post(route('work-hours.store'), $this->payload([
                'windows' => [['start_at' => '2026-06-20T10:00:30', 'end_at' => '2026-06-20T11:00:30']],
            ]))
            ->assertRedirect();

        $this->assertSame(1, WorkHour::where('user_id', $user->id)->count());
        $this->assertSame(1, WorkHour::where('user_id', $user->id)->first()->windows()->count());
    }

    public function test_window_overlapping_a_tracked_session_is_rejected(): void
    {
        $user = $this->inOfficeUser();
        TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-w',
            'started_at' => Carbon::parse('2026-06-20 10:00', 'Asia/Karachi'),
            'stopped_at' => Carbon::parse('2026-06-20 11:00', 'Asia/Karachi'),
            'total_seconds' => 3600, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        $this->actingAs($user)
            ->post(route('work-hours.store'), $this->payload([
                'windows' => [['start_at' => '2026-06-20T10:30:00', 'end_at' => '2026-06-20T11:30:00']],
            ]))
            ->assertSessionHasErrors();

        $this->assertSame(0, WorkHour::where('user_id', $user->id)->count());
    }

    public function test_window_outside_in_office_hours_is_rejected(): void
    {
        $user = $this->inOfficeUser();

        $this->actingAs($user)
            ->post(route('work-hours.store'), $this->payload([
                'windows' => [['start_at' => '2026-06-20T18:00:00', 'end_at' => '2026-06-20T19:00:00']],
            ]))
            ->assertSessionHasErrors();

        $this->assertSame(0, WorkHour::where('user_id', $user->id)->count());
    }

    public function test_update_replaces_windows_and_recomputes_hours(): void
    {
        $user = $this->inOfficeUser();
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-20', 'hours' => 1.0,
            'description' => 'old', 'work_type' => 'manual', 'source' => 'manual',
        ]);
        $wh->windows()->create([
            'start_at' => Carbon::parse('2026-06-20 10:00', 'Asia/Karachi'),
            'end_at' => Carbon::parse('2026-06-20 11:00', 'Asia/Karachi'),
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload([
                'description' => 'new',
                'windows' => [['start_at' => '2026-06-20T10:00:00', 'end_at' => '2026-06-20T12:00:00']],
            ]))
            ->assertRedirect();

        $fresh = $wh->fresh();
        $this->assertEqualsWithDelta(2.0, (float) $fresh->hours, 0.001);
        $this->assertSame(1, $fresh->windows()->count());
        $this->assertSame('new', $fresh->description);
    }

    public function test_tracked_row_keeps_locked_hours_even_with_windows_posted(): void
    {
        $user = $this->inOfficeUser();
        $session = TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-lock-w',
            'started_at' => Carbon::parse('2026-06-20 09:00', 'Asia/Karachi'),
            'stopped_at' => Carbon::parse('2026-06-20 12:24', 'Asia/Karachi'),
            'total_seconds' => 12250, 'status' => 'stopped', 'source' => 'desktop',
        ]);
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => '2026-06-20', 'hours' => 3.4,
            'description' => 'tracked', 'work_type' => 'tracker',
            'source' => 'tracker', 'tracking_session_id' => $session->id,
        ]);

        $this->actingAs($user)
            ->put(route('work-hours.update', $wh), $this->payload([
                'hours' => 8,
                'minutes' => 0,
                'work_type' => 'tracker',
                'windows' => [['start_at' => '2026-06-20T13:00:00', 'end_at' => '2026-06-20T16:00:00']],
            ]))
            ->assertRedirect();

        $fresh = $wh->fresh();
        $this->assertEqualsWithDelta(3.4, (float) $fresh->hours, 0.001, 'tracked hours must not change');
        $this->assertSame(0, $fresh->windows()->count(), 'tracked rows get no windows');
    }
}
