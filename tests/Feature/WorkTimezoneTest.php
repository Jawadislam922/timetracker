<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkTimezoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_work_timezone_falls_back_to_app_timezone_when_unset(): void
    {
        $user = new User();
        $user->work_timezone = null;

        $this->assertSame(config('app.timezone'), $user->workTimezone());
    }

    public function test_explicit_work_timezone_is_returned(): void
    {
        $user = User::factory()->create(['work_timezone' => 'America/New_York']);

        $this->assertSame('America/New_York', $user->workTimezone());
    }

    public function test_attendance_day_is_bucketed_in_the_workers_own_timezone(): void
    {
        // 02:00 on Jun 27 in Karachi (UTC+5) is still Jun 26 in New York (UTC-4),
        // so the same instant must file under each worker's OWN calendar day.
        $instant = Carbon::parse('2026-06-27 02:00:00', 'Asia/Karachi');

        $karachi = User::factory()->create([
            'work_timezone' => 'Asia/Karachi',
            'shift_start_time' => null,
        ]);
        $newYork = User::factory()->create([
            'work_timezone' => 'America/New_York',
            'shift_start_time' => null,
        ]);

        $this->assertSame('2026-06-27', $karachi->attendanceDateFor($instant->copy()));
        $this->assertSame('2026-06-26', $newYork->attendanceDateFor($instant->copy()));
    }

    public function test_existing_karachi_workers_are_unchanged_by_the_new_column(): void
    {
        // A Karachi worker with a real shift still buckets exactly as before the
        // work_timezone column existed (regression guard for the no-op promise).
        $employee = User::factory()->create([
            'work_timezone' => 'Asia/Karachi',
            'shift_start_time' => '16:00:00',
        ]);

        // Post-midnight work for a 16:00 shift stays on the shift's start day.
        $instant = Carbon::parse('2026-06-10 01:00:00', 'Asia/Karachi');

        $this->assertSame('2026-06-09', $employee->attendanceDateFor($instant));
    }
}
