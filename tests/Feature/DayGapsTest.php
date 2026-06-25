<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\WorkHour;
use App\Support\DayGaps;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * DayGaps computes a user's untracked open time for a day = in-office (clock
 * in→out minus breaks) minus tracked sessions minus existing manual windows.
 */
class DayGapsTest extends TestCase
{
    use RefreshDatabase;

    private function entry(User $u, string $type, string $date, string $time): void
    {
        $ts = Carbon::parse("$date $time", 'Asia/Karachi');
        TimeEntry::create([
            'user_id' => $u->id,
            'action_type' => $type,
            'action_timestamp' => $ts,
            'action_date' => $date,
            'action_time' => $ts->toTimeString(),
        ]);
    }

    public function test_multi_segment_day_subtracts_breaks_tracked_and_existing_manual(): void
    {
        $user = User::factory()->create();
        $date = '2026-06-20';

        // Lunch split: in-office 09:00–13:00 and 14:00–17:00.
        $this->entry($user, 'clock_in', $date, '09:00');
        $this->entry($user, 'break_start', $date, '10:00');
        $this->entry($user, 'break_end', $date, '10:30');
        $this->entry($user, 'clock_out', $date, '13:00');
        $this->entry($user, 'clock_in', $date, '14:00');
        $this->entry($user, 'clock_out', $date, '17:00');

        // Tracked session 11:00–12:00 inside the morning segment.
        TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-gap',
            'started_at' => Carbon::parse("$date 11:00", 'Asia/Karachi'),
            'stopped_at' => Carbon::parse("$date 12:00", 'Asia/Karachi'),
            'total_seconds' => 3600, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        // Existing manual window 15:00–15:30 in the afternoon segment.
        $wh = WorkHour::create([
            'user_id' => $user->id, 'date' => $date, 'hours' => 0.5,
            'description' => 'm', 'work_type' => 'manual', 'source' => 'manual',
        ]);
        $wh->windows()->create([
            'start_at' => Carbon::parse("$date 15:00", 'Asia/Karachi'),
            'end_at' => Carbon::parse("$date 15:30", 'Asia/Karachi'),
        ]);

        $gaps = DayGaps::compute($user, Carbon::parse($date, 'Asia/Karachi'))['gaps'];
        $labels = array_map(fn ($g) => $g['start'].'-'.$g['end'], $gaps);

        $this->assertEqualsCanonical([
            '09:00-10:00', '10:30-11:00', '12:00-13:00', // morning
            '14:00-15:00', '15:30-17:00',                 // afternoon
        ], $labels);
    }

    public function test_still_clocked_in_leaves_an_open_gap_to_now(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-06-20 11:00:00', 'Asia/Karachi'));

        $user = User::factory()->create();
        $this->entry($user, 'clock_in', '2026-06-20', '09:00');

        $gaps = DayGaps::compute($user, Carbon::parse('2026-06-20', 'Asia/Karachi'))['gaps'];

        $this->assertCount(1, $gaps);
        $this->assertSame('09:00', $gaps[0]['start']);
        $this->assertSame('11:00', $gaps[0]['end']);

        Carbon::setTestNow();
    }

    public function test_no_clock_in_means_no_gaps(): void
    {
        $user = User::factory()->create();

        $result = DayGaps::compute($user, Carbon::parse('2026-06-20', 'Asia/Karachi'));

        $this->assertSame([], $result['gaps']);
        $this->assertSame([], $result['in_office']);
    }

    private function assertEqualsCanonical(array $expected, array $actual): void
    {
        sort($expected);
        sort($actual);
        $this->assertSame($expected, $actual);
    }
}
