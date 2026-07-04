<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use App\Services\ActivityDigestService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Two surfaces that previously bucketed tracked time differently from the
 * dashboard/Timeline (found in the pre-test sweep):
 *   1. The Slack activity digest summed raw total_seconds by start-date.
 *   2. The dashboard "Activity %" weighted by whole-session total, not the
 *      calendar-day share, so it disagreed with the "Tracked today" beside it.
 * Both now use TrackingSessionService::inDaySeconds — pinned here.
 */
class DigestAndActivityConsistencyTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_activity_digest_splits_an_overnight_session_by_calendar_day(): void
    {
        $tz = config('app.timezone');
        Carbon::setTestNow(Carbon::parse('2026-07-04 12:00', $tz));

        $user = User::factory()->create([
            'include_in_slack_reports' => true,
            'tracks_time' => true,
            'is_active' => true,
        ]);

        // 22:00 Jul 3 -> 02:00 Jul 4 (4h wall), 3600s tracked → 1800s each day.
        TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-overnight',
            'started_at' => Carbon::parse('2026-07-03 22:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-04 02:00', $tz),
            'total_seconds' => 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $svc = app(ActivityDigestService::class);

        // Today's digest credits only the post-midnight 1800s (not 0, not 3600).
        $today = $svc->buildPayload(Carbon::parse('2026-07-04 00:00', $tz), Carbon::parse('2026-07-04 23:59:59', $tz));
        $this->assertSame(1800, $today['rows'][0]['total_seconds'] ?? null, 'today = post-midnight share');

        // Yesterday's digest credits the pre-midnight 1800s (was: full 3600).
        $yesterday = $svc->buildPayload(Carbon::parse('2026-07-03 00:00', $tz), Carbon::parse('2026-07-03 23:59:59', $tz));
        $this->assertSame(1800, $yesterday['rows'][0]['total_seconds'] ?? null, 'yesterday = pre-midnight share');
    }

    public function test_dashboard_activity_matches_the_calendar_day_tracked_denominator(): void
    {
        $tz = config('app.timezone');
        Carbon::setTestNow(Carbon::parse('2026-07-04 12:00', $tz));

        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);

        // Overnight A: 22:00 Jul 3 -> 02:00 Jul 4 (4h), 3600s @ 90% → today-share 1800s.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-a',
            'started_at' => Carbon::parse('2026-07-03 22:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-04 02:00', $tz),
            'total_seconds' => 3600,
            'activity_percent' => 90,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);
        // Today B: 10:00 -> 11:00, 3600s @ 30%, fully today.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-b',
            'started_at' => Carbon::parse('2026-07-04 10:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-04 11:00', $tz),
            'total_seconds' => 3600,
            'activity_percent' => 30,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $row = $this->actingAs($member)
            ->getJson('/time-entries/today-summary')
            ->assertOk()
            ->json('employees.0');

        // Tracked today = 1800 + 3600 = 5400s = 1.5h.
        $this->assertEqualsWithDelta(1.5, $row['tracked_hours'], 0.01);
        // Activity weighted by IN-DAY share: (90*1800 + 30*3600)/5400 = 50%.
        // (The old whole-session weighting gave 60% — irreconcilable with 1.5h.)
        $this->assertSame(50, $row['activity_percent']);
    }
}
