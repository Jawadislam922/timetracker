<?php

namespace Tests\Feature;

use App\Models\Shift;
use App\Models\TimeEntry;
use App\Models\User;
use App\Models\UserShiftAssignment;
use App\Models\UserShiftOverride;
use App\Support\AttendanceHours;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Changing someone's shift must not rewrite their past.
 *
 * Attendance status is computed live from the shift on the user record, so
 * before standing-shift history existed, HR editing a shift time — or moving
 * somebody between shifts — retroactively turned on-time days into "late" for
 * that person's entire history. These tests pin the era boundary that fixes it.
 */
class ShiftHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function worker(string $start = '09:00', int $grace = 15): User
    {
        return User::factory()->create([
            'shift_start_time' => $start,
            'shift_grace_minutes' => $grace,
            'work_timezone' => 'Asia/Karachi',
        ]);
    }

    private function clockIn(User $user, string $dateTime): TimeEntry
    {
        $ts = Carbon::parse($dateTime, $user->workTimezone());

        return TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => 'clock_in',
            'action_timestamp' => $ts,
            'action_date' => $ts->toDateString(),
            'action_time' => $ts->format('H:i:s'),
        ]);
    }

    private function era(User $user, string $from, array $values): UserShiftAssignment
    {
        return UserShiftAssignment::create(array_merge([
            'user_id' => $user->id,
            'effective_from' => $from,
            'work_timezone' => 'Asia/Karachi',
        ], $values));
    }

    /** THE HEADLINE CASE: an on-time past day stays on time after a shift change. */
    public function test_a_past_on_time_day_is_not_re_judged_by_a_later_shift_change(): void
    {
        $user = $this->worker('09:00', 15);
        $entry = $this->clockIn($user, '2026-08-10 09:05:00');   // on time under 09:00+15

        // History up to the 15th was worked on the 09:00 shift...
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 15]);
        // ...then HR moves them to an 05:00 start from the 15th.
        $this->era($user, '2026-08-15', ['shift_start_time' => '05:00', 'shift_grace_minutes' => 15]);
        $user->shift_start_time = '05:00';
        $user->save();

        $this->assertFalse(
            AttendanceHours::isLateClockIn($user->fresh(), Carbon::parse('2026-08-10', 'Asia/Karachi'), $entry),
            'a day worked under the old shift must stay on time'
        );
    }

    /** Days on or after the change ARE judged by the new shift. */
    public function test_days_from_the_effective_date_use_the_new_shift(): void
    {
        $user = $this->worker('09:00', 15);
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 15]);
        $this->era($user, '2026-08-15', ['shift_start_time' => '05:00', 'shift_grace_minutes' => 15]);

        $late = $this->clockIn($user, '2026-08-16 09:05:00');    // way past 05:00+15

        $this->assertTrue(
            AttendanceHours::isLateClockIn($user->fresh(), Carbon::parse('2026-08-16', 'Asia/Karachi'), $late)
        );
    }

    /** The effective date itself belongs to the NEW era; the day before does not. */
    public function test_the_effective_date_is_inclusive(): void
    {
        $user = $this->worker('09:00', 15);
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 15]);
        $this->era($user, '2026-08-15', ['shift_start_time' => '05:00', 'shift_grace_minutes' => 15]);
        $user = $user->fresh();

        $dayBefore = $this->clockIn($user, '2026-08-14 09:05:00');
        $boundary = $this->clockIn($user, '2026-08-15 09:05:00');

        $this->assertFalse(
            AttendanceHours::isLateClockIn($user, Carbon::parse('2026-08-14', 'Asia/Karachi'), $dayBefore),
            'the day before the change still uses the old shift'
        );
        $this->assertTrue(
            AttendanceHours::isLateClockIn($user, Carbon::parse('2026-08-15', 'Asia/Karachi'), $boundary),
            'the effective date itself uses the new shift'
        );
    }

    /** Grace minutes are era-resolved too, not read off the live user row. */
    public function test_grace_minutes_are_historical(): void
    {
        $user = $this->worker('09:00', 30);
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 30]);
        $entry = $this->clockIn($user, '2026-08-10 09:20:00');   // fine under 30m grace

        // Grace tightened to 5 minutes from today onwards.
        $this->era($user, '2026-08-15', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 5]);
        $user->shift_grace_minutes = 5;
        $user->save();

        $this->assertFalse(
            AttendanceHours::isLateClockIn($user->fresh(), Carbon::parse('2026-08-10', 'Asia/Karachi'), $entry),
            'the old day keeps the 30-minute grace it was worked under'
        );

        $after = $this->clockIn($user, '2026-08-16 09:20:00');
        $this->assertTrue(
            AttendanceHours::isLateClockIn($user->fresh(), Carbon::parse('2026-08-16', 'Asia/Karachi'), $after),
            'new days use the tightened grace'
        );
    }

    /** A one-day override still beats the era for its exact date. */
    public function test_a_one_day_override_wins_over_the_era(): void
    {
        $user = $this->worker('09:00', 15);
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 15]);

        UserShiftOverride::create([
            'user_id' => $user->id,
            'date' => '2026-08-10',
            'shift_start_time' => '12:00',
            'reason' => 'Doctor',
        ]);

        $entry = $this->clockIn($user, '2026-08-10 11:55:00');

        $this->assertFalse(
            AttendanceHours::isLateClockIn($user->fresh(), Carbon::parse('2026-08-10', 'Asia/Karachi'), $entry),
            'the approved late start applies'
        );
    }

    /** With no era rows at all, behaviour falls back to the user columns. */
    public function test_falls_back_to_the_current_columns_when_no_era_covers_the_date(): void
    {
        $user = $this->worker('09:00', 15);
        $entry = $this->clockIn($user, '2026-08-10 09:30:00');

        $this->assertTrue(
            AttendanceHours::isLateClockIn($user, Carbon::parse('2026-08-10', 'Asia/Karachi'), $entry),
            'no history yet: judge against the standing shift, exactly as before'
        );
    }

    /** Editing a user's shift records an era; an unrelated edit does not. */
    public function test_updating_the_shift_records_an_era(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $user = $this->worker('09:00', 15);

        $payload = fn (array $over = []) => array_merge([
            'name' => $user->name,
            'email' => $user->email,
            'role' => 'member',
            'shift_start_time' => '09:00',
            'shift_grace_minutes' => 15,
            'work_timezone' => 'Asia/Karachi',
        ], $over);

        // An edit that leaves the shift alone writes no history.
        $this->actingAs($admin)->put(route('users.update', $user), $payload(['name' => 'Renamed Person']))
            ->assertSessionHasNoErrors();
        $this->assertSame(0, UserShiftAssignment::where('user_id', $user->id)->count());

        // Changing the shift start does.
        $this->actingAs($admin)->put(route('users.update', $user), $payload([
            'name' => 'Renamed Person',
            'shift_start_time' => '07:00',
            'shift_effective_from' => '2026-08-16',
        ]))->assertSessionHasNoErrors();

        $era = UserShiftAssignment::where('user_id', $user->id)->firstOrFail();
        $this->assertSame('2026-08-16', $era->effective_from->toDateString());
        $this->assertSame('07:00', $era->shift_start_time->format('H:i'));
        $this->assertSame($admin->id, $era->created_by);

        // A second change on the same date updates that era rather than stacking.
        $this->actingAs($admin)->put(route('users.update', $user), $payload([
            'name' => 'Renamed Person',
            'shift_start_time' => '06:30',
            'shift_effective_from' => '2026-08-16',
        ]))->assertSessionHasNoErrors();

        $this->assertSame(1, UserShiftAssignment::where('user_id', $user->id)->count());
        $this->assertSame('06:30', UserShiftAssignment::where('user_id', $user->id)->first()->shift_start_time->format('H:i'));
    }

    /** Moving someone to a different named shift also opens an era. */
    public function test_changing_the_assigned_shift_label_records_an_era(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $user = $this->worker('09:00', 15);
        $night = Shift::firstOrCreate(['name' => 'Night'], ['sort_order' => 4]);

        $this->actingAs($admin)->put(route('users.update', $user), [
            'name' => $user->name, 'email' => $user->email, 'role' => 'member',
            'shift_start_time' => '09:00', 'shift_grace_minutes' => 15,
            'work_timezone' => 'Asia/Karachi', 'shift_id' => $night->id,
        ])->assertSessionHasNoErrors();

        $this->assertSame($night->id, UserShiftAssignment::where('user_id', $user->id)->firstOrFail()->shift_id);
    }

    /** A future effective date is rejected — the users.* cache would be wrong. */
    public function test_a_future_effective_date_is_rejected(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $user = $this->worker('09:00', 15);

        $this->actingAs($admin)->put(route('users.update', $user), [
            'name' => $user->name, 'email' => $user->email, 'role' => 'member',
            'shift_start_time' => '07:00', 'shift_grace_minutes' => 15,
            'work_timezone' => 'Asia/Karachi',
            'shift_effective_from' => now()->addMonth()->toDateString(),
        ])->assertSessionHasErrors('shift_effective_from');
    }

    /**
     * The repair command must not want to re-file history after a shift change.
     *
     * It recomputes each punch's attendance day; before eras existed, a shift
     * edit made every historical punch look mis-filed and the command would
     * physically move them to different days.
     */
    public function test_the_repair_command_finds_nothing_after_a_shift_change(): void
    {
        $user = $this->worker('09:00', 15);
        $this->era($user, '2000-01-01', ['shift_start_time' => '09:00', 'shift_grace_minutes' => 15]);
        $this->clockIn($user, '2026-08-10 09:05:00');

        // Shift moves to 05:00 from the 15th; the 10th belongs to the old era.
        $this->era($user, '2026-08-15', ['shift_start_time' => '05:00', 'shift_grace_minutes' => 15]);
        $user->shift_start_time = '05:00';
        $user->save();

        $this->artisan('attendance:repair-action-dates', ['--since' => '2026-08-01'])
            ->assertSuccessful();

        $this->assertSame(
            '2026-08-10',
            TimeEntry::where('user_id', $user->id)->first()->action_date->toDateString(),
            'the punch stayed on its original attendance day'
        );
    }
}
