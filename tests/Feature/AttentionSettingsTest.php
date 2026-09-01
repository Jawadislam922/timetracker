<?php

namespace Tests\Feature;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin-selectable Needs Attention warning types.
 *
 * With the desktop trackers deliberately off fleet-wide, "Clocked in but not
 * tracking" fires for every web-clocked person and floods the dashboard.
 * Hiding a type must remove it EVERYWHERE it renders — the needs-attention
 * list, the KPI count, and the Team shift board's exception line — while the
 * default (nothing hidden) keeps today's behaviour exactly.
 */
class AttentionSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function teamAdmin(): User
    {
        return User::factory()->create(['role' => 'admin', 'permissions' => ['dashboard.view_team']]);
    }

    /** A member clocked in via the web with no tracker: the not_tracking case. */
    private function webClockedMember(string $name = 'Web Worker'): User
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => [], 'name' => $name]);
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_in',
            'action_timestamp' => Carbon::now('Asia/Karachi'),
            'action_date' => Carbon::now('Asia/Karachi')->toDateString(),
            'action_time' => Carbon::now('Asia/Karachi')->format('H:i:s'),
        ]);

        return $member;
    }

    public function test_hiding_not_tracking_removes_the_rows_and_the_kpi_count_together(): void
    {
        $this->travelTo(Carbon::parse('2026-06-15 20:00:00', 'Asia/Karachi'));
        $admin = $this->teamAdmin();
        $member = $this->webClockedMember();

        MonitoringSetting::current()->update(['attention_hidden_types' => ['not_tracking']]);

        $res = $this->actingAs($admin)->getJson('/time-entries/today-summary');
        $res->assertOk();

        $attention = collect($res->json('needs_attention'));
        $this->assertFalse(
            $attention->where('user_id', $member->id)->contains('type', 'not_tracking'),
            'A hidden warning type must not appear in the list.'
        );
        $this->assertSame(
            $attention->count(),
            $res->json('team_kpis.needs_attention'),
            'The KPI count must agree with the filtered list.'
        );

        $this->travelBack();
    }

    public function test_the_shift_board_exception_is_suppressed_too(): void
    {
        $this->travelTo(Carbon::parse('2026-06-15 20:00:00', 'Asia/Karachi'));
        $admin = $this->teamAdmin();
        $member = $this->webClockedMember();

        $boardRow = function ($response) use ($member) {
            return collect($response->json('shift_board.bands'))
                ->flatMap(fn ($b) => $b['members'] ?? [])
                ->firstWhere('user_id', $member->id);
        };

        // Visible by default...
        $before = $boardRow($this->actingAs($admin)->getJson('/time-entries/today-summary'));
        $this->assertNotNull($before, 'Expected the member on the shift board.');
        $this->assertSame('Clocked in but not tracking', $before['exception']);

        // ...and gone once hidden. current() memoizes the model instance per
        // process, and update() mutates that same instance, so no flush needed.
        MonitoringSetting::current()->update(['attention_hidden_types' => ['not_tracking']]);

        $after = $boardRow($this->actingAs($admin)->getJson('/time-entries/today-summary'));
        $this->assertNotNull($after);
        $this->assertNull($after['exception'], 'The hidden warning must not resurface as shift-board text.');

        $this->travelBack();
    }

    public function test_an_unhidden_type_still_shows_when_another_is_hidden(): void
    {
        $this->travelTo(Carbon::parse('2026-06-15 20:00:00', 'Asia/Karachi'));
        $admin = $this->teamAdmin();

        // Late: clocked in hours past a 09:00 + 15m shift.
        $late = User::factory()->create([
            'role' => 'member', 'permissions' => [], 'name' => 'Late Worker',
            'shift_start_time' => '09:00', 'shift_grace_minutes' => 15, 'work_timezone' => 'Asia/Karachi',
        ]);
        TimeEntry::create([
            'user_id' => $late->id, 'action_type' => 'clock_in',
            'action_timestamp' => Carbon::now('Asia/Karachi'),
            'action_date' => Carbon::now('Asia/Karachi')->toDateString(),
            'action_time' => Carbon::now('Asia/Karachi')->format('H:i:s'),
        ]);

        MonitoringSetting::current()->update(['attention_hidden_types' => ['not_tracking']]);

        $attention = collect($this->actingAs($admin)->getJson('/time-entries/today-summary')->json('needs_attention'));
        $this->assertTrue(
            $attention->where('user_id', $late->id)->contains('type', 'late'),
            'Hiding one type must not swallow the others.'
        );

        $this->travelBack();
    }

    public function test_settings_endpoint_validates_the_type_names(): void
    {
        $admin = User::factory()->create(['role' => 'super_admin', 'permissions' => []]);
        $payload = MonitoringSetting::current()->teamPayload();

        // An unknown type is rejected...
        $this->actingAs($admin)
            ->putJson(route('settings.team.update'), array_merge($payload, ['attention_hidden_types' => ['nonsense_type']]))
            ->assertStatus(422);

        // ...a real one and an empty array both save.
        $this->actingAs($admin)
            ->putJson(route('settings.team.update'), array_merge($payload, ['attention_hidden_types' => ['not_tracking', 'low_activity']]))
            ->assertOk();
        $this->assertSame(['not_tracking', 'low_activity'], MonitoringSetting::query()->find(1)->attention_hidden_types);

        $this->actingAs($admin)
            ->putJson(route('settings.team.update'), array_merge($payload, ['attention_hidden_types' => []]))
            ->assertOk();
        $this->assertSame([], MonitoringSetting::query()->find(1)->attention_hidden_types);
    }
}
