<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use App\Services\TrackingSessionService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * Dashboard, Timeline, and Team must report the SAME tracked time for the same
 * user/day. They historically drifted because each computed it differently and
 * the Dashboard ignored still-running sessions (it only reads work_hours, which
 * is written on stop). They now all route through
 * TrackingSessionService::inDaySeconds and the Dashboard folds in live sessions.
 */
class TrackedHoursConsistencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_live_session_agrees_across_dashboard_timeline_and_team(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'permissions' => ['timeline.view_others'],
        ]);

        // A still-running session, one hour in, fully inside today. A fully
        // inside live session must count its whole total on every page.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-live',
            'started_at' => now()->subHour(),
            'last_heartbeat_at' => now(),
            'total_seconds' => 3600,
            'status' => TrackingSession::STATUS_ACTIVE,
            'source' => 'desktop',
        ]);

        // Timeline (member viewing their own day): day total = 3600s.
        $this->actingAs($member)
            ->get('/timeline')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('initialData.totals.day', 3600)
            );

        // Team (admin): the only tracked time today is the member's live hour.
        $this->actingAs($admin)
            ->get('/team?range=today')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('totals.day', 3600)
            );

        // Dashboard (member): even though the session hasn't stopped (so there
        // is no work_hours row), today reads 1h because live sessions are folded
        // into the per-day sums.
        $this->actingAs($member)
            ->get('/dashboard')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('analytics.summary.today', '1h')
            );
    }

    public function test_today_summary_tracked_matches_timeline_for_overnight_session(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        $tz = config('app.timezone');
        $todayStart = Carbon::today($tz);

        // Overnight session: 10pm yesterday -> 3am today, 5h tracked. Its today
        // share is the 3am portion = 3h. There is NO work_hours row (the desktop
        // sync didn't run in the test), so the OLD endpoint — which read
        // work_hours by attendance date — reported 0h here. The fix computes it
        // from the session via inDaySeconds, matching the Timeline.
        $session = TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-overnight',
            'started_at' => $todayStart->copy()->subHours(2),
            'stopped_at' => $todayStart->copy()->addHours(3),
            'total_seconds' => 5 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $expectedSeconds = app(TrackingSessionService::class)
            ->inDaySeconds($session, $todayStart->copy(), $todayStart->copy()->endOfDay());
        $this->assertSame(3 * 3600, $expectedSeconds);

        // Timeline day total.
        $this->actingAs($member)
            ->get('/timeline')
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->where('initialData.totals.day', $expectedSeconds)
            );

        // Dashboard "Team Activity Today" feed must report the same number.
        $tracked = $this->actingAs($member)
            ->getJson('/time-entries/today-summary')
            ->assertOk()
            ->json('employees.0.tracked_hours');

        $this->assertEqualsWithDelta($expectedSeconds / 3600, $tracked, 0.01);
    }
}
