<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The dashboard's ranged "Team Activity" endpoint shows tracked + in-office for
 * a chosen window (yesterday / this week / custom), using the SAME inDaySeconds
 * + dayInOfficeHours the Team page and live table use — so the numbers agree.
 */
class TeamActivityRangeTest extends TestCase
{
    use RefreshDatabase;

    public function test_yesterday_range_reports_that_days_tracked_and_in_office(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'permissions' => ['dashboard.view_team']]);
        $member = User::factory()->create(['role' => 'member', 'permissions' => [], 'name' => 'Range Worker']);

        $tz = config('app.timezone');
        $yesterday = Carbon::today($tz)->subDay();

        // 3h tracked + a 5h clock-in/out window, all yesterday.
        TrackingSession::create([
            'user_id' => $member->id,
            'client_uuid' => 'uuid-yday',
            'started_at' => $yesterday->copy()->setTime(9, 0),
            'stopped_at' => $yesterday->copy()->setTime(12, 0),
            'total_seconds' => 3 * 3600,
            'status' => TrackingSession::STATUS_STOPPED,
            'source' => 'desktop',
        ]);
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_in',
            'action_timestamp' => $yesterday->copy()->setTime(9, 0), 'action_date' => $yesterday->toDateString(), 'action_time' => '09:00:00',
        ]);
        TimeEntry::create([
            'user_id' => $member->id, 'action_type' => 'clock_out',
            'action_timestamp' => $yesterday->copy()->setTime(14, 0), 'action_date' => $yesterday->toDateString(), 'action_time' => '14:00:00',
        ]);

        $res = $this->actingAs($admin)->getJson('/time-entries/team-activity?range=yesterday');
        $res->assertOk();

        $row = collect($res->json('employees'))->firstWhere('user_id', $member->id);
        $this->assertNotNull($row, 'Expected the worker to appear in the yesterday range.');
        $this->assertEqualsWithDelta(3 * 3600, $row['tracked_seconds'], 5);
        $this->assertEqualsWithDelta(5 * 3600, $row['in_office_seconds'], 5);
        $this->assertSame(1, $row['days_worked']);
    }

    public function test_range_is_gated_to_team_viewers(): void
    {
        $member = User::factory()->create(['role' => 'member', 'permissions' => []]);
        $this->actingAs($member)->getJson('/time-entries/team-activity?range=week')->assertForbidden();
    }
}
