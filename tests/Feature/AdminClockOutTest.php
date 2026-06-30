<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin / super-admin (attendance.edit_times) can clock out a worker who forgot.
 * The close defaults to the worker's shift end, stops their tracker, and is
 * audited; the Slack clock-out post is suppressed.
 */
class AdminClockOutTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create([
            'role' => 'admin', 'permissions' => ['attendance.edit_times'], 'tracks_time' => false,
        ]);
    }

    public function test_admin_clocks_out_forgotten_session_at_shift_end_and_audits(): void
    {
        $admin = $this->admin();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_hours' => 8, 'tracks_time' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-09 09:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])->assertOk();

        // Next morning, still open — admin closes it.
        Carbon::setTestNow(Carbon::parse('2026-06-10 10:00:00', 'Asia/Karachi'));
        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-out'), ['user_id' => $emp->id])
            ->assertOk();

        $entries = TimeEntry::forUser($emp->id)->orderBy('action_timestamp')->get();
        $this->assertCount(2, $entries);
        $this->assertSame('clock_out', $entries[1]->action_type);
        // Shift end = 09:00 + 8h = 17:00 on the clock-in's day (June 9).
        $this->assertSame('17:00', Carbon::parse($entries[1]->action_timestamp)->setTimezone('Asia/Karachi')->format('H:i'));
        $this->assertSame('2026-06-09', $entries[1]->action_date->toDateString());

        $this->assertDatabaseHas('tracking_audit_logs', [
            'subject_user_id' => $emp->id,
            'actor_user_id' => $admin->id,
            'action' => 'attendance.admin_clock_out',
        ]);

        Carbon::setTestNow();
    }

    public function test_a_member_without_permission_is_forbidden(): void
    {
        $actor = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $emp = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($actor)
            ->postJson(route('employee-attendance.clock-out'), ['user_id' => $emp->id])
            ->assertForbidden();
    }

    public function test_clock_out_when_not_clocked_in_is_rejected(): void
    {
        $admin = $this->admin();
        $emp = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-out'), ['user_id' => $emp->id])
            ->assertStatus(422);
    }

    public function test_clock_out_lands_after_a_break_taken_past_shift_end(): void
    {
        $admin = $this->admin();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_hours' => 8, 'tracks_time' => true,
        ]);

        // Clock in, then go on break AFTER the 17:00 shift end, so the default
        // close time (shift end) would land before the break.
        Carbon::setTestNow(Carbon::parse('2026-06-10 09:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])->assertOk();
        Carbon::setTestNow(Carbon::parse('2026-06-10 18:30:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'break_start'])->assertOk();

        Carbon::setTestNow(Carbon::parse('2026-06-10 19:00:00', 'Asia/Karachi'));
        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-out'), ['user_id' => $emp->id])
            ->assertOk();

        $last = TimeEntry::forUser($emp->id)->orderByDesc('action_timestamp')->orderByDesc('id')->first();
        $this->assertSame('clock_out', $last->action_type);
        // The clock-out must sit AFTER the 18:30 break, not at the 17:00 shift end,
        // so the session reads as genuinely closed.
        $this->assertTrue(
            Carbon::parse($last->action_timestamp)->setTimezone('Asia/Karachi')->greaterThan(Carbon::parse('2026-06-10 18:30:00', 'Asia/Karachi'))
        );

        Carbon::setTestNow();
    }

    public function test_custom_time_closes_a_session_resumed_after_a_break(): void
    {
        $admin = $this->admin();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_hours' => 8, 'tracks_time' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-10 09:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])->assertOk();
        Carbon::setTestNow(Carbon::parse('2026-06-10 12:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'break_start'])->assertOk();
        Carbon::setTestNow(Carbon::parse('2026-06-10 12:30:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'break_end'])->assertOk();

        // Last action is break_end (resumed). Admin still closes at a custom time.
        Carbon::setTestNow(Carbon::parse('2026-06-10 20:00:00', 'Asia/Karachi'));
        $this->actingAs($admin)
            ->postJson(route('employee-attendance.clock-out'), ['user_id' => $emp->id, 'time' => '17:30', 'note' => 'left at 5:30'])
            ->assertOk();

        $last = TimeEntry::forUser($emp->id)->orderByDesc('action_timestamp')->first();
        $this->assertSame('clock_out', $last->action_type);
        $this->assertSame('17:30', Carbon::parse($last->action_timestamp)->setTimezone('Asia/Karachi')->format('H:i'));
        $this->assertStringStartsWith('Admin clock-out', (string) $last->notes);

        Carbon::setTestNow();
    }
}
