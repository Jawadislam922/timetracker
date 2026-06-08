<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeAttendanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_summary_never_returns_negative_break_time_for_future_entries(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-08 10:00:00', 'Asia/Karachi'));

        $admin = User::factory()->create(['role' => 'super_admin']);
        $employee = User::factory()->create(['name' => 'Future Entry User']);

        TimeEntry::create([
            'user_id' => $employee->id,
            'action_type' => 'clock_in',
            'action_timestamp' => Carbon::parse('2026-06-08 15:00:00', 'Asia/Karachi'),
            'action_date' => '2026-06-08',
            'action_time' => '15:00:00',
        ]);

        TimeEntry::create([
            'user_id' => $employee->id,
            'action_type' => 'break_start',
            'action_timestamp' => Carbon::parse('2026-06-08 16:00:00', 'Asia/Karachi'),
            'action_date' => '2026-06-08',
            'action_time' => '16:00:00',
        ]);

        $employeeRow = collect(
            $this->actingAs($admin)
                ->getJson(route('employee-attendance.summary', ['date' => '2026-06-08']))
                ->assertOk()
                ->json('employees')
        )->firstWhere('user_id', $employee->id);

        $this->assertEquals(0.0, $employeeRow['total_work_hours']);
        $this->assertEquals(0.0, $employeeRow['total_break_hours']);

        Carbon::setTestNow();
    }

    public function test_attendance_summary_calculates_completed_work_and_break_time(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-08 14:00:00', 'Asia/Karachi'));

        $admin = User::factory()->create(['role' => 'super_admin']);
        $employee = User::factory()->create(['name' => 'Completed Entry User']);

        foreach ([
            ['clock_in', '09:00:00'],
            ['break_start', '10:00:00'],
            ['break_end', '10:30:00'],
            ['clock_out', '12:00:00'],
        ] as [$action, $time]) {
            TimeEntry::create([
                'user_id' => $employee->id,
                'action_type' => $action,
                'action_timestamp' => Carbon::parse("2026-06-08 {$time}", 'Asia/Karachi'),
                'action_date' => '2026-06-08',
                'action_time' => $time,
            ]);
        }

        $employeeRow = collect(
            $this->actingAs($admin)
                ->getJson(route('employee-attendance.summary', ['date' => '2026-06-08']))
                ->assertOk()
                ->json('employees')
        )->firstWhere('user_id', $employee->id);

        $this->assertSame(2.5, $employeeRow['total_work_hours']);
        $this->assertSame(0.5, $employeeRow['total_break_hours']);
        $this->assertSame('Clocked Out', $employeeRow['current_status']);

        Carbon::setTestNow();
    }
}
