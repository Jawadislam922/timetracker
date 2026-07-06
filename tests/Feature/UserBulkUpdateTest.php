<?php

namespace Tests\Feature;

use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bulk edit gained the fields that were previously single-edit-only: shift name,
 * shift length, clock-out reminder, work timezone, role, tracks-time, devices.
 * Attendance/profile fields are open to any users.manage actor; role/tracks/
 * devices/permissions stay Super Admin only, mirroring store()/update().
 */
class UserBulkUpdateTest extends TestCase
{
    use RefreshDatabase;

    private function superAdmin(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'super_admin', 'permissions' => []], $overrides));
    }

    /** A plain admin who can reach the Users page (users.manage) but is not Super Admin. */
    private function manager(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'admin', 'permissions' => ['users.manage']], $overrides));
    }

    public function test_super_admin_bulk_sets_the_new_attendance_fields(): void
    {
        $admin = $this->superAdmin();
        $shift = Shift::where('name', 'Evening')->first();
        $a = User::factory()->create(['shift_id' => null, 'work_timezone' => 'Asia/Karachi', 'shift_hours' => null, 'clockout_reminder_minutes' => null]);
        $b = User::factory()->create(['shift_id' => null, 'work_timezone' => 'Asia/Karachi', 'shift_hours' => null, 'clockout_reminder_minutes' => null]);

        $this->actingAs($admin)->postJson(route('users.bulk-update'), [
            'user_ids' => [$a->id, $b->id],
            'set_shift_id' => true, 'shift_id' => $shift->id,
            'set_shift_hours' => true, 'shift_hours' => 10,
            'set_clockout_reminder' => true, 'clockout_reminder_minutes' => 20,
            'set_work_timezone' => true, 'work_timezone' => 'Asia/Dubai',
        ])->assertOk();

        foreach ([$a, $b] as $u) {
            $u->refresh();
            $this->assertSame($shift->id, $u->shift_id);
            $this->assertSame(10.0, (float) $u->shift_hours);
            $this->assertSame(20, (int) $u->clockout_reminder_minutes);
            $this->assertSame('Asia/Dubai', $u->work_timezone);
        }
    }

    public function test_unchecked_sections_leave_values_untouched(): void
    {
        $admin = $this->superAdmin();
        $shift = Shift::where('name', 'Morning')->first();
        $u = User::factory()->create(['shift_id' => $shift->id, 'work_timezone' => 'Asia/Karachi']);

        // Only work timezone is toggled; shift_id must remain.
        $this->actingAs($admin)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_shift_id' => false, 'shift_id' => null,
            'set_work_timezone' => true, 'work_timezone' => 'Europe/London',
        ])->assertOk();

        $u->refresh();
        $this->assertSame($shift->id, $u->shift_id, 'shift must be untouched when its box is unchecked');
        $this->assertSame('Europe/London', $u->work_timezone);
    }

    public function test_manager_can_set_attendance_fields_but_not_role_or_tracking(): void
    {
        $manager = $this->manager();
        $shift = Shift::where('name', 'Noon')->first();
        $u = User::factory()->create(['role' => 'member', 'shift_id' => null, 'tracks_time' => true]);

        // Attendance field allowed for a plain manager.
        $this->actingAs($manager)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_shift_id' => true, 'shift_id' => $shift->id,
        ])->assertOk();
        $this->assertSame($shift->id, $u->fresh()->shift_id);

        // Role change is Super Admin only → forbidden, and nothing changes.
        $this->actingAs($manager)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_role' => true, 'role' => 'admin',
        ])->assertForbidden();
        $this->assertSame('member', $u->fresh()->role);

        // tracks_time change is Super Admin only → forbidden.
        $this->actingAs($manager)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_tracks_time' => true, 'tracks_time' => false,
        ])->assertForbidden();
        $this->assertTrue((bool) $u->fresh()->tracks_time);
    }

    public function test_slack_report_inclusion_is_super_admin_only_in_bulk(): void
    {
        $manager = $this->manager();
        $u = User::factory()->create(['role' => 'member', 'include_in_slack_reports' => true]);

        // A plain manager cannot bulk-toggle Slack inclusion (mirrors update()).
        $this->actingAs($manager)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'slack_reports' => 'exclude',
        ])->assertForbidden();
        $this->assertTrue((bool) $u->fresh()->include_in_slack_reports);

        // A Super Admin can.
        $this->actingAs($this->superAdmin())->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'slack_reports' => 'exclude',
        ])->assertOk();
        $this->assertFalse((bool) $u->fresh()->include_in_slack_reports);
    }

    public function test_super_admin_bulk_sets_role_tracking_and_devices(): void
    {
        $admin = $this->superAdmin();
        $u = User::factory()->create(['role' => 'member', 'tracks_time' => true, 'allow_multiple_devices' => false]);

        $this->actingAs($admin)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_role' => true, 'role' => 'admin',
            'set_tracks_time' => true, 'tracks_time' => false,
            'set_allow_multiple_devices' => true, 'allow_multiple_devices' => true,
        ])->assertOk();

        $u->refresh();
        $this->assertSame('admin', $u->role);
        $this->assertFalse((bool) $u->tracks_time);
        $this->assertTrue((bool) $u->allow_multiple_devices);
    }

    public function test_set_role_without_a_chosen_role_does_not_demote_to_member(): void
    {
        $admin = $this->superAdmin();
        $u = User::factory()->create(['role' => 'admin']);

        // The box is checked but no role picked (role null) — must be a no-op.
        $this->actingAs($admin)->postJson(route('users.bulk-update'), [
            'user_ids' => [$u->id],
            'set_role' => true, 'role' => null,
        ])->assertOk();

        $this->assertSame('admin', $u->fresh()->role, 'a toggled-but-unpicked role must never silently demote');
    }

    public function test_super_admin_cannot_demote_themselves_out_of_super_admin_in_bulk(): void
    {
        $admin = $this->superAdmin();
        $other = User::factory()->create(['role' => 'member']);

        $this->actingAs($admin)->postJson(route('users.bulk-update'), [
            'user_ids' => [$admin->id, $other->id],
            'set_role' => true, 'role' => 'member',
        ])->assertOk();

        $this->assertSame('super_admin', $admin->fresh()->role, 'self must stay Super Admin');
        $this->assertSame('member', $other->fresh()->role);
    }
}
