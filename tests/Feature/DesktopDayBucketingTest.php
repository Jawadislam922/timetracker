<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use App\Services\TrackingSessionService;
use App\Support\BusinessTime;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The desktop app's /sessions/today and /sessions/week must bucket overnight
 * sessions exactly like the Timeline (inDaySeconds split across the days a
 * session touches). Regression for the "Timeline and the application don't
 * match" report: the old endpoints lumped a session's whole total onto its
 * START date, so any session crossing midnight disagreed with the website.
 */
class DesktopDayBucketingTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function makeOvernightSession(User $user): TrackingSession
    {
        // 22:00 yesterday -> 02:00 today (4h wall), 3600s tracked (idle out).
        // Proportional split: 1800s yesterday, 1800s today.
        $tz = BusinessTime::tz();
        $start = Carbon::today($tz)->subDay()->setTime(22, 0);
        $stop = Carbon::today($tz)->setTime(2, 0);

        return TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-overnight',
            'started_at' => $start,
            'stopped_at' => $stop,
            'total_seconds' => 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'work_type' => 'tracker_manual',
        ]);
    }

    public function test_today_endpoint_reports_only_the_in_day_share_of_an_overnight_session(): void
    {
        // Freeze at 03:00 so "today" clearly contains the 00:00-02:00 tail.
        Carbon::setTestNow(Carbon::today(BusinessTime::tz())->setTime(3, 0));

        $user = User::factory()->create();
        $session = $this->makeOvernightSession($user);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $response = $this->getJson('/api/desktop/sessions/today')->assertOk();
        $sessions = collect($response->json('sessions'));

        // The overnight session IS listed for today (it overlaps today)...
        $row = $sessions->firstWhere('id', $session->id);
        $this->assertNotNull($row, 'overnight session must appear in today');

        // ...but contributes only its post-midnight share, exactly what the
        // Timeline's inDaySeconds gives for today.
        $svc = app(TrackingSessionService::class);
        $tz = BusinessTime::tz();
        $expected = $svc->inDaySeconds($session, Carbon::today($tz), Carbon::today($tz)->endOfDay());
        $this->assertSame($expected, $row['total_seconds']);
        $this->assertSame(1800, $row['total_seconds']);
    }

    public function test_week_endpoint_splits_an_overnight_session_across_both_days_like_the_timeline(): void
    {
        Carbon::setTestNow(Carbon::today(BusinessTime::tz())->setTime(3, 0));

        $user = User::factory()->create();
        $this->makeOvernightSession($user);
        Sanctum::actingAs($user, ['desktop-tracker']);

        $days = collect($this->getJson('/api/desktop/sessions/week')->assertOk()->json('days'))
            ->keyBy('date');

        $tz = BusinessTime::tz();
        $yesterday = Carbon::today($tz)->subDay()->toDateString();
        $today = Carbon::today($tz)->toDateString();

        // 22:00-24:00 share lands on yesterday, 00:00-02:00 share on today —
        // NOT the whole 3600s on the start date.
        $this->assertSame(1800, $days[$yesterday]['total_seconds']);
        $this->assertSame(1800, $days[$today]['total_seconds']);
    }
}
