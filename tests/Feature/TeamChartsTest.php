<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Team Performance charts payload is computed from the SAME sessions +
 * inDaySeconds as the member table, so a chart can never disagree with a row
 * total. This guards that invariant: the per-day hours sum to the table total.
 */
class TeamChartsTest extends TestCase
{
    use RefreshDatabase;

    public function test_chart_daily_totals_equal_the_table_total(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['timeline.view_others']]);
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $tz = config('app.timezone');
        $today = Carbon::today($tz);
        $yesterday = $today->copy()->subDay();

        // 3h yesterday + 2h today = 5h across the two-day range.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-y',
            'started_at' => $yesterday->copy()->setTime(9, 0),
            'stopped_at' => $yesterday->copy()->setTime(12, 0),
            'total_seconds' => 3 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-t',
            'started_at' => $today->copy()->setTime(9, 0),
            'stopped_at' => $today->copy()->setTime(11, 0),
            'total_seconds' => 2 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $response = $this->actingAs($admin)
            ->get('/team?start='.$yesterday->toDateString().'&end='.$today->toDateString());
        $response->assertOk();

        $props = $response->viewData('page')['props'];

        // Table total = 5h (3h + 2h).
        $this->assertSame(5 * 3600, $props['totals']['day']);

        $charts = $props['charts'];
        $this->assertCount(2, $charts['labels']);
        // Per-day chart hours must sum to the table's total (to the second).
        $this->assertEqualsWithDelta(5.0, array_sum($charts['hours_per_day']), 0.02);
        $this->assertArrayHasKey('activity_per_day', $charts);
        $this->assertArrayHasKey('top_clients', $charts);
        $this->assertArrayHasKey('top_apps', $charts);
    }

    public function test_client_less_sessions_are_labelled_by_work_type_not_unassigned(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['timeline.view_others']]);
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $today = Carbon::today(config('app.timezone'));

        // Non-billable work with no client — should chart as "Office Work", not "Unassigned".
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'ow-1',
            'work_type' => 'office_work',
            'started_at' => $today->copy()->setTime(9, 0),
            'stopped_at' => $today->copy()->setTime(11, 0),
            'total_seconds' => 2 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $props = $this->actingAs($admin)->get('/team?range=today')->assertOk()->viewData('page')['props'];
        $labels = collect($props['charts']['top_clients'])->pluck('label');

        $this->assertTrue($labels->contains('Office Work'), 'Client-less office work should be labelled by work type.');
        $this->assertFalse($labels->contains('Unassigned'), 'There should be no "Unassigned" bucket.');
    }

    public function test_per_person_analytics_shows_tracked_and_in_office_gap_and_is_gated(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['analytics.view']]);
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $tz = config('app.timezone');
        $today = Carbon::today($tz);

        // 2h tracked today.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-p',
            'started_at' => $today->copy()->setTime(9, 0),
            'stopped_at' => $today->copy()->setTime(11, 0),
            'total_seconds' => 2 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);
        // 4h in office (clock-in → clock-out), so the gap is 2h present-but-not-tracking.
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_in',
            'action_timestamp' => $today->copy()->setTime(9, 0), 'action_date' => $today->toDateString(), 'action_time' => '09:00:00',
        ]);
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_out',
            'action_timestamp' => $today->copy()->setTime(13, 0), 'action_date' => $today->toDateString(), 'action_time' => '13:00:00',
        ]);

        $response = $this->actingAs($admin)->get('/team/member/'.$member->id.'?range=today');
        $response->assertOk();
        $charts = $response->viewData('page')['props']['charts'];

        $this->assertEqualsWithDelta(2.0, array_sum($charts['tracked_hours']), 0.02);
        $this->assertEqualsWithDelta(4.0, array_sum($charts['in_office_hours']), 0.02);
        $this->assertSame(2 * 3600, $response->viewData('page')['props']['totals']['tracked_seconds']);

        // Gated: a viewer without analytics.view is forbidden.
        $noPerm = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $this->actingAs($noPerm)->get('/team/member/'.$member->id.'?range=today')->assertForbidden();
    }
}
