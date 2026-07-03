<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * attendanceDayWindowFor() must be the exact inverse of attendanceDateFor():
 * every instant inside the window buckets to the same attendance date, and
 * the instants just outside bucket elsewhere. This is what lets the dashboard
 * cards and the desktop "today" ring follow a night shift across midnight.
 */
class WorkDayWindowTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /**
     * For a steady shift, sample instants across 3 days every 30 minutes:
     * window membership must match attendanceDateFor exactly.
     *
     * @dataProvider shiftProvider
     */
    public function test_window_is_the_exact_inverse_of_attendance_date(?string $shiftStart): void
    {
        $user = User::factory()->create(['shift_start_time' => $shiftStart]);
        $tz = $user->workTimezone();

        $cursor = Carbon::parse('2026-06-10 00:00', $tz);
        $end = Carbon::parse('2026-06-13 00:00', $tz);

        for (; $cursor->lt($end); $cursor->addMinutes(30)) {
            $date = $user->attendanceDateFor($cursor);
            [$winStart, $winEnd] = $user->attendanceDayWindowFor($cursor->copy());

            // The instant itself is inside its own window...
            $this->assertTrue(
                $cursor->greaterThanOrEqualTo($winStart) && $cursor->lessThan($winEnd),
                "{$cursor} (shift ".($shiftStart ?? 'none').") outside its own window [{$winStart}, {$winEnd})"
            );

            // ...everything in the window maps to the same date...
            $this->assertSame($date, $user->attendanceDateFor($winStart->copy()), "window start of {$cursor}");
            $this->assertSame($date, $user->attendanceDateFor($winEnd->copy()->subMinute()), "window end-1min of {$cursor}");

            // ...and the instants just outside map to different dates.
            $this->assertNotSame($date, $user->attendanceDateFor($winStart->copy()->subMinute()), "before window of {$cursor}");
            $this->assertNotSame($date, $user->attendanceDateFor($winEnd->copy()), "at window end of {$cursor}");
        }
    }

    public static function shiftProvider(): array
    {
        return [
            'evening shift 16:00 (spills past midnight)' => ['16:00:00'],
            'day shift 09:00 (plain calendar day)' => ['09:00:00'],
            'midnight shift 00:00 (early grace opens the evening before)' => ['00:00:00'],
            'night shift 02:00' => ['02:00:00'],
            'afternoon shift 13:00' => ['13:00:00'],
            'no shift set' => [null],
        ];
    }

    public function test_night_worker_dashboard_splits_calendar_days_with_yesterday_column(): void
    {
        // Redesign 2026-07-04: the dashboard is tracked-only and a tracked day
        // is a plain CALENDAR day (matches Timeline + desktop). The night
        // shift's evening work lands in the Yesterday column after midnight.
        $tz = config('app.timezone');
        Carbon::setTestNow(Carbon::parse('2026-07-04 01:30', $tz));

        $member = User::factory()->create([
            'role' => 'member',
            'permissions' => [],
            'shift_start_time' => '16:00:00',
        ]);

        // Tracked 22:00 -> 01:00 (3h): 2h belong to Jul 3, 1h to Jul 4.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-evening',
            'started_at' => Carbon::parse('2026-07-03 22:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-04 01:00', $tz),
            'total_seconds' => 3 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $row = $this->actingAs($member)
            ->getJson('/time-entries/today-summary')
            ->assertOk()
            ->json('employees.0');

        $this->assertEqualsWithDelta(1.0, $row['tracked_hours'], 0.01, 'today = post-midnight hour');
        $this->assertEqualsWithDelta(2.0, $row['tracked_yesterday_hours'], 0.01, 'yesterday = pre-midnight 2h');
        // Week (since Mon Jun 29) and month (since Jul 1) both contain all 3h.
        $this->assertEqualsWithDelta(3.0, $row['tracked_week_hours'], 0.01);
        $this->assertEqualsWithDelta(3.0, $row['tracked_month_hours'], 0.01);

        // Desktop "today" ring: same calendar rule — only the 1h after midnight.
        Sanctum::actingAs($member, ['desktop-tracker']);
        $sessions = collect($this->getJson('/api/desktop/sessions/today')->assertOk()->json('sessions'));
        $this->assertEqualsWithDelta(1 * 3600, $sessions->sum('total_seconds'), 60);
    }

    public function test_day_worker_dashboard_totals_are_plain_calendar_days(): void
    {
        $tz = config('app.timezone');
        Carbon::setTestNow(Carbon::parse('2026-07-03 15:00', $tz));

        $member = User::factory()->create([
            'role' => 'member',
            'permissions' => [],
            'shift_start_time' => '09:00:00',
        ]);

        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-day',
            'started_at' => Carbon::parse('2026-07-03 10:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-03 14:00', $tz),
            'total_seconds' => 4 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);
        // Yesterday's separate session shows up only in yesterday/week/month.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-day-before',
            'started_at' => Carbon::parse('2026-07-02 10:00', $tz),
            'stopped_at' => Carbon::parse('2026-07-02 12:00', $tz),
            'total_seconds' => 2 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);

        $row = $this->actingAs($member)
            ->getJson('/time-entries/today-summary')
            ->assertOk()
            ->json('employees.0');

        $this->assertEqualsWithDelta(4.0, $row['tracked_hours'], 0.01);
        $this->assertEqualsWithDelta(2.0, $row['tracked_yesterday_hours'], 0.01);
        $this->assertEqualsWithDelta(6.0, $row['tracked_week_hours'], 0.01, 'week = Jul 2 + Jul 3');
        $this->assertEqualsWithDelta(6.0, $row['tracked_month_hours'], 0.01, 'month = Jul 2 + Jul 3');
    }
}
