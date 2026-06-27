<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkTimezoneStage2Test extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_auto_close_fires_at_the_workers_shift_end_in_their_timezone(): void
    {
        // New York VA, 09:00 shift, 8h. If auto-close used Karachi, the shift end
        // would be computed ~9-10h off and close at the wrong instant.
        $ny = User::factory()->create([
            'work_timezone' => 'America/New_York',
            'shift_start_time' => '09:00:00',
            'shift_hours' => 8,
        ]);

        // NOTE: the SQLite test driver reads datetimes back as floating wall-clock
        // (production MySQL reads them in the app timezone), so the clock-in is
        // seeded as a New York wall-clock to keep the in-test shift math aligned.
        $clockIn = Carbon::parse('2026-06-15 09:00:00', 'America/New_York');
        TimeEntry::create([
            'user_id' => $ny->id,
            'action_type' => 'clock_in',
            'action_timestamp' => $clockIn,
            'action_date' => $ny->attendanceDateFor($clockIn->copy()),
            'action_time' => $clockIn->copy()->setTimezone('America/New_York')->toTimeString(),
            'notes' => 'Desktop app',
        ]);

        // Past 17:00 NY shift end + 20m buffer.
        Carbon::setTestNow(Carbon::parse('2026-06-15 17:30:00', 'America/New_York'));

        $this->artisan('attendance:auto-clock-out', ['--user' => $ny->id, '--buffer-minutes' => 20])
            ->assertSuccessful();

        $clockOut = TimeEntry::where('user_id', $ny->id)->where('action_type', 'clock_out')->first();
        $this->assertNotNull($clockOut, 'auto-close should have written a clock_out');

        // Shift end 17:00 NY + 20m buffer = 17:20 New York = 02:20 next-day Karachi.
        // action_timestamp is stored in the app timezone, so its wall-clock is the
        // Karachi value. The Karachi-WRONG path would instead store 2026-06-15
        // 17:20, so this asserts the shift end was computed in the worker's zone.
        $this->assertSame('2026-06-16 02:20', $clockOut->action_timestamp->format('Y-m-d H:i'));
        // And it files under the worker's NY attendance day (the clock-in's day).
        $this->assertSame('2026-06-15', $clockOut->action_date->toDateString());
    }

    public function test_clock_editor_parses_entered_time_in_the_subjects_timezone(): void
    {
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'permissions' => ['attendance.edit_times'],
        ]);
        $ny = User::factory()->create([
            'work_timezone' => 'America/New_York',
            'shift_start_time' => '09:00:00',
        ]);

        $this->actingAs($admin)
            ->postJson('/employee-attendance/clock-times', [
                'user_id' => $ny->id,
                'date' => '2026-06-15',
                'clock_in' => '09:00',
                'clock_out' => '17:00',
                'reason' => 'Forgot to clock in',
            ])
            ->assertOk();

        $clockIn = TimeEntry::where('user_id', $ny->id)->where('action_type', 'clock_in')->firstOrFail();

        // "09:00" was entered as the worker's New York wall-clock, not Karachi.
        $this->assertSame(
            '09:00',
            $clockIn->action_timestamp->copy()->setTimezone('America/New_York')->format('H:i')
        );
        $this->assertSame('2026-06-15', $clockIn->action_date->toDateString());

        // The prefill endpoint reports the subject's zone so the dialog can label it.
        $this->actingAs($admin)
            ->getJson('/employee-attendance/day-entries?user_id='.$ny->id.'&date=2026-06-15')
            ->assertOk()
            ->assertJsonPath('timezone', 'America/New_York')
            ->assertJsonPath('clock_in', '09:00');
    }

    public function test_karachi_worker_clock_editor_is_unchanged(): void
    {
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'permissions' => ['attendance.edit_times'],
        ]);
        $local = User::factory()->create(['work_timezone' => 'Asia/Karachi']);

        $this->actingAs($admin)
            ->postJson('/employee-attendance/clock-times', [
                'user_id' => $local->id,
                'date' => '2026-06-15',
                'clock_in' => '16:00',
                'clock_out' => '20:00',
                'reason' => 'Correction',
            ])
            ->assertOk();

        $clockIn = TimeEntry::where('user_id', $local->id)->where('action_type', 'clock_in')->firstOrFail();
        $this->assertSame('16:00', $clockIn->action_timestamp->copy()->setTimezone('Asia/Karachi')->format('H:i'));
        $this->assertSame('2026-06-15', $clockIn->action_date->toDateString());
    }
}
