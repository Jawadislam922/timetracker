<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The dashboard command center (KPI strip + needs-attention list + at-a-glance
 * trend) is rolled up from the SAME rows + inDaySeconds the live team table
 * uses, so it can never contradict the numbers below it. These guard the KPI
 * counts, the needs-attention signals, and the trend buckets summing to the
 * table total.
 */
class DashboardOverviewTest extends TestCase
{
    use RefreshDatabase;

    private function teamAdmin(): User
    {
        return User::factory()->create(['role' => 'admin', 'permissions' => ['dashboard.view_team']]);
    }

    public function test_team_kpis_count_present_and_flag_clocked_in_but_not_tracking(): void
    {
        // Freeze "now" so a fresh clock-in is neither late nor stale.
        $this->travelTo(Carbon::parse('2026-06-15 20:00:00', 'Asia/Karachi'));

        $admin = $this->teamAdmin();
        $member = User::factory()->create(['role' => 'member', 'permissions' => [], 'name' => 'Open Worker']);

        // Clocked in, no clock-out, no tracker session → present + working, but
        // nothing tracked: the "clocked in but not tracking" amber signal.
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_in',
            'action_timestamp' => Carbon::now('Asia/Karachi'),
            'action_date' => Carbon::now('Asia/Karachi')->toDateString(),
            'action_time' => Carbon::now('Asia/Karachi')->format('H:i:s'),
        ]);

        $res = $this->actingAs($admin)->getJson('/time-entries/today-summary');
        $res->assertOk();

        $kpis = $res->json('team_kpis');
        $this->assertSame(1, $kpis['present']);
        $this->assertSame(1, $kpis['working']);
        $this->assertSame(0, $kpis['on_break']);

        $attention = collect($res->json('needs_attention'));
        $flag = $attention->firstWhere('user_id', $member->id);
        $this->assertNotNull($flag, 'Expected a needs-attention entry for the open worker.');
        $this->assertTrue(
            $attention->where('user_id', $member->id)->contains('type', 'not_tracking'),
            'Expected the not_tracking signal.'
        );

        $this->travelBack();
    }

    public function test_stale_clock_out_uses_the_same_shift_end_plus_buffer_as_auto_close(): void
    {
        // Now is 20:00; a 09:00 shift of 8h ends 17:00, +20m buffer = 17:20 —
        // well in the past, so an still-open clock-in must flag as stale (the
        // exact window AutoCloseAttendance would close).
        $this->travelTo(Carbon::parse('2026-06-15 20:00:00', 'Asia/Karachi'));

        $admin = $this->teamAdmin();
        $member = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_hours' => 8,
        ]);

        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_in',
            'action_timestamp' => Carbon::parse('2026-06-15 09:00:00', 'Asia/Karachi'),
            'action_date' => '2026-06-15', 'action_time' => '09:00:00',
        ]);

        $res = $this->actingAs($admin)->getJson('/time-entries/today-summary');
        $res->assertOk();

        $this->assertTrue(
            collect($res->json('needs_attention'))
                ->where('user_id', $member->id)
                ->contains('type', 'stale_clock_out'),
            'Expected a stale_clock_out (red) signal past shift end + buffer.'
        );

        $this->travelBack();
    }

    public function test_dashboard_trend_buckets_sum_to_the_tracked_total(): void
    {
        $admin = $this->teamAdmin();
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $today = Carbon::today('Asia/Karachi');
        // 2h tracked today.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-trend',
            'started_at' => $today->copy()->setTime(9, 0),
            'stopped_at' => $today->copy()->setTime(11, 0),
            'total_seconds' => 2 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $res = $this->actingAs($admin)->getJson('/time-entries/dashboard-trend?range=today');
        $res->assertOk();

        $this->assertSame('hour', $res->json('granularity'));
        $this->assertCount(24, $res->json('labels'));
        $this->assertEqualsWithDelta(2.0, array_sum($res->json('hours')), 0.02);
    }

    public function test_dashboard_trend_is_personal_for_non_team_viewers(): void
    {
        $viewer = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $other = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $today = Carbon::today('Asia/Karachi');
        // Someone else's 3h today must NOT show in the viewer's personal trend.
        TrackingSession::create([
            'user_id' => $other->id,
            'client_uuid' => 'uuid-other',
            'started_at' => $today->copy()->setTime(9, 0),
            'stopped_at' => $today->copy()->setTime(12, 0),
            'total_seconds' => 3 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $res = $this->actingAs($viewer)->getJson('/time-entries/dashboard-trend?range=today');
        $res->assertOk();
        $this->assertEqualsWithDelta(0.0, array_sum($res->json('hours')), 0.001);
    }
}
