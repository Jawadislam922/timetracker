<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingAuditLog;
use App\Models\User;
use App\Support\AttendanceHours;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admins with attendance.edit_times can set/correct an employee's clock-in/out
 * times for a day; the change is audited and the in-office hours recompute.
 */
class ClockTimeEditTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'permissions' => ['attendance.edit_times']]);
    }

    public function test_super_admin_can_grant_the_permission_to_an_admin(): void
    {
        $superAdmin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $target = User::factory()->create(['role' => 'admin', 'permissions' => []]);

        $this->actingAs($superAdmin)
            ->put(route('users.update', $target), [
                'name' => $target->name,
                'email' => $target->email,
                'role' => 'admin',
                'permissions' => ['attendance.edit_times'],
            ])
            ->assertRedirect();

        $this->assertContains('attendance.edit_times', $target->fresh()->permissions ?? []);
    }

    public function test_admin_with_permission_sets_clock_times_and_audits(): void
    {
        $admin = $this->admin();
        $employee = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-times'), [
                'user_id' => $employee->id,
                'date' => '2026-06-20',
                'clock_in' => '09:00',
                'clock_out' => '17:00',
                'reason' => 'Forgot to clock in; confirmed arrival 9am',
            ])
            ->assertOk();

        $entries = TimeEntry::forUser($employee->id)->orderBy('action_timestamp')->get();
        $this->assertCount(2, $entries);
        $this->assertSame('clock_in', $entries[0]->action_type);
        $this->assertSame('clock_out', $entries[1]->action_type);
        $this->assertSame('2026-06-20', $entries[0]->action_date->toDateString());

        // In-office hours derive live from these rows.
        $this->assertEqualsWithDelta(8.0, AttendanceHours::dayInOfficeHours($entries), 0.001);

        $this->assertDatabaseHas('tracking_audit_logs', [
            'subject_user_id' => $employee->id,
            'actor_user_id' => $admin->id,
            'action' => 'attendance.clock_edit',
        ]);
    }

    public function test_admin_without_permission_is_forbidden(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => []]);
        $employee = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-times'), [
                'user_id' => $employee->id,
                'date' => '2026-06-20',
                'clock_in' => '09:00',
                'reason' => 'x',
            ])
            ->assertForbidden();

        $this->assertSame(0, TimeEntry::forUser($employee->id)->count());
    }

    public function test_overnight_clock_out_buckets_to_the_shift_date(): void
    {
        $admin = $this->admin();
        $employee = User::factory()->create([
            'role' => 'member', 'permissions' => [], 'shift_start_time' => '22:00:00',
        ]);

        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-times'), [
                'user_id' => $employee->id,
                'date' => '2026-06-20',
                'clock_in' => '22:00',
                'clock_out' => '06:00', // next calendar morning
                'reason' => 'Overnight shift correction',
            ])
            ->assertOk();

        $entries = TimeEntry::forUser($employee->id)->orderBy('action_timestamp')->get();
        $this->assertCount(2, $entries);
        // Both belong to the 2026-06-20 shift even though clock-out is on the 21st.
        $this->assertSame('2026-06-20', $entries[0]->action_date->toDateString());
        $this->assertSame('2026-06-20', $entries[1]->action_date->toDateString());
        $this->assertSame('2026-06-21', $entries[1]->action_timestamp->setTimezone('Asia/Karachi')->toDateString());
    }

    public function test_morning_clock_in_for_evening_shift_is_rejected(): void
    {
        $admin = $this->admin();
        // Evening-shift worker: a 09:00 clock-in buckets to the previous day's
        // shift, so editing it under date 2026-06-20 must be rejected.
        $employee = User::factory()->create([
            'role' => 'member', 'permissions' => [], 'shift_start_time' => '22:00:00',
        ]);

        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-times'), [
                'user_id' => $employee->id,
                'date' => '2026-06-20',
                'clock_in' => '09:00',
                'reason' => 'mismatched bucket',
            ])
            ->assertStatus(422);

        $this->assertSame(0, TimeEntry::forUser($employee->id)->count());
    }
}
