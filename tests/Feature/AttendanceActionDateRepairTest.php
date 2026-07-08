<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * A clock punch's attendance day is authoritatively attendanceDateFor() of its
 * own timestamp. The repair command refiles rows that disagree (the reported
 * bug: a clock-in just before shift start stored on the previous day) while
 * leaving legitimate night-shift spillover — where the stored day already
 * matches the recompute — untouched.
 */
class AttendanceActionDateRepairTest extends TestCase
{
    use RefreshDatabase;

    private function punch(User $user, string $type, string $ts, string $actionDate): TimeEntry
    {
        $carbon = Carbon::parse($ts, 'Asia/Karachi');

        return TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => $type,
            'action_timestamp' => $carbon,
            'action_date' => $actionDate, // deliberately set, possibly wrong
            'action_time' => $carbon->toTimeString(),
        ]);
    }

    public function test_repair_refiles_a_clockin_dated_to_the_previous_day(): void
    {
        $day = User::factory()->create(['shift_start_time' => '09:00:00', 'work_timezone' => 'Asia/Karachi']);
        // Clocked in 08:58 today but mis-filed under yesterday (the Aqsa bug).
        $bad = $this->punch($day, 'clock_in', '2026-07-08 08:58:53', '2026-07-07');

        // A 16:00-shift worker clocking in 00:30 IS legitimately yesterday's
        // shift (spillover) — stored day already correct, must stay untouched.
        $night = User::factory()->create(['shift_start_time' => '16:00:00', 'work_timezone' => 'Asia/Karachi']);
        $spill = $this->punch($night, 'clock_in', '2026-07-08 00:30:00', '2026-07-07');

        $this->assertSame('2026-07-07', $bad->fresh()->getRawOriginal('action_date') ? substr($bad->fresh()->getRawOriginal('action_date'), 0, 10) : null);

        $this->artisan('attendance:repair-action-dates', ['--apply' => true])->assertExitCode(0);

        $this->assertSame('2026-07-08', substr((string) $bad->fresh()->getRawOriginal('action_date'), 0, 10), 'mis-filed clock-in should move to its real day');
        $this->assertSame('2026-07-07', substr((string) $spill->fresh()->getRawOriginal('action_date'), 0, 10), 'legitimate spillover must be left untouched');
        // action_timestamp must be preserved exactly (no re-save corruption).
        $this->assertSame('2026-07-08 08:58:53', $bad->fresh()->action_timestamp->toDateTimeString());
    }

    public function test_dry_run_reports_but_does_not_change(): void
    {
        $user = User::factory()->create(['shift_start_time' => '09:00:00', 'work_timezone' => 'Asia/Karachi']);
        $bad = $this->punch($user, 'clock_in', '2026-07-08 08:58:53', '2026-07-07');

        $this->artisan('attendance:repair-action-dates')->assertExitCode(0); // no --apply

        $this->assertSame('2026-07-07', substr((string) $bad->fresh()->getRawOriginal('action_date'), 0, 10), 'dry run must not write');
    }

    public function test_guard_logs_a_warning_when_a_punch_is_created_mis_filed(): void
    {
        Log::spy();
        $user = User::factory()->create(['shift_start_time' => '09:00:00', 'work_timezone' => 'Asia/Karachi']);

        $this->punch($user, 'clock_in', '2026-07-08 08:58:53', '2026-07-07');

        Log::shouldHaveReceived('warning')
            ->withArgs(fn ($message) => str_contains((string) $message, 'action_date mismatch'))
            ->atLeast()->once();
    }
}
