<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * PR1 (audit) — route-level authorization is consistent with the controller
 * guards: attendance WRITE endpoints require attendance.manual_mark (not just
 * the read permission), and saving the AI assistant's questions requires the
 * settings permission. Locks the permission model so a future route edit can't
 * silently widen access.
 */
class AuthorizationHardeningTest extends TestCase
{
    use RefreshDatabase;

    public function test_attendance_viewer_without_manual_mark_cannot_write(): void
    {
        $viewer = User::factory()->create(['role' => 'member', 'permissions' => ['attendance.view']]);

        $this->actingAs($viewer)
            ->patch('/employee-attendance/manual-status', ['user_id' => 1, 'date' => '2026-06-28'])
            ->assertForbidden();

        $this->actingAs($viewer)
            ->post('/employee-attendance/calendar', [])
            ->assertForbidden();
    }

    public function test_marker_passes_the_route_guard(): void
    {
        $marker = User::factory()->create(['role' => 'admin', 'permissions' => ['attendance.view', 'attendance.manual_mark']]);

        // Empty payload → validation (422), NOT 403: proves the permission guard
        // let the marker through to the controller.
        $this->actingAs($marker)
            ->patchJson('/employee-attendance/manual-status', [])
            ->assertStatus(422);
    }

    public function test_saving_ai_questions_requires_settings_permission(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $this->actingAs($member)->post('/ai-assistant/questions', ['questions' => []])->assertForbidden();

        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['monitoring.settings']]);
        $this->actingAs($admin)->postJson('/ai-assistant/questions', ['questions' => ['How many hours?']])->assertOk();
    }
}
