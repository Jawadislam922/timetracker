<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Services\WeeklyDigestService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WeeklyDigestTest extends TestCase
{
    use RefreshDatabase;

    private function clock(User $u, string $type, string $datetime): void
    {
        $ts = Carbon::parse($datetime, 'Asia/Karachi');
        TimeEntry::create([
            'user_id' => $u->id,
            'action_type' => $type,
            'action_timestamp' => $ts,
            'action_date' => $ts->toDateString(),
            'action_time' => $ts->toTimeString(),
        ]);
    }

    public function test_payload_has_per_person_metrics_and_sorts_by_gap(): void
    {
        $start = Carbon::parse('2026-06-15', 'Asia/Karachi'); // Mon
        $end = Carbon::parse('2026-06-21', 'Asia/Karachi');   // Sun

        // Member A: in office 7.5h (09:30–17:30 minus 30m break), tracked 5h,
        // clocked in late (shift 09:00 + 15m grace, in at 09:30).
        $a = User::factory()->create(['name' => 'Aman Shah']);
        $a->forceFill(['include_in_slack_reports' => true, 'shift_start_time' => '09:00:00', 'shift_grace_minutes' => 15])->save();
        $this->clock($a, 'clock_in', '2026-06-16 09:30:00');
        $this->clock($a, 'break_start', '2026-06-16 12:00:00');
        $this->clock($a, 'break_end', '2026-06-16 12:30:00');
        $this->clock($a, 'clock_out', '2026-06-16 17:30:00');
        TrackingSession::create([
            'user_id' => $a->id, 'client_uuid' => 'uuid-a',
            'started_at' => Carbon::parse('2026-06-16 09:30:00', 'Asia/Karachi'),
            'stopped_at' => Carbon::parse('2026-06-16 14:30:00', 'Asia/Karachi'),
            'total_seconds' => 5 * 3600, 'activity_percent' => 50, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        // Member B: in office ~4h, tracked ~3.5h (smaller gap), on time.
        $b = User::factory()->create(['name' => 'Sara Ali']);
        $b->forceFill(['include_in_slack_reports' => true, 'shift_start_time' => '09:00:00', 'shift_grace_minutes' => 15])->save();
        $this->clock($b, 'clock_in', '2026-06-16 09:00:00');
        $this->clock($b, 'clock_out', '2026-06-16 13:00:00');
        TrackingSession::create([
            'user_id' => $b->id, 'client_uuid' => 'uuid-b',
            'started_at' => Carbon::parse('2026-06-16 09:00:00', 'Asia/Karachi'),
            'stopped_at' => Carbon::parse('2026-06-16 12:30:00', 'Asia/Karachi'),
            'total_seconds' => (int) (3.5 * 3600), 'activity_percent' => 70, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        $payload = app(WeeklyDigestService::class)->buildPayload($start, $end);

        $this->assertCount(2, $payload['rows']);

        // Biggest in-office-vs-tracked gap first → Aman (2.5h gap) before Sara (0.5h).
        $first = $payload['rows'][0];
        $this->assertSame('Aman Shah', $first['name']);
        $this->assertEqualsWithDelta(7.5, $first['in_office_hours'], 0.05);
        $this->assertEqualsWithDelta(5.0, $first['tracked_hours'], 0.05);
        $this->assertEqualsWithDelta(2.5, $first['gap_hours'], 0.05);
        $this->assertSame(50, $first['activity_percent']);
        $this->assertSame(1, $first['late_days']);

        $second = $payload['rows'][1];
        $this->assertSame('Sara Ali', $second['name']);
        $this->assertSame(0, $second['late_days']);
        $this->assertTrue($second['gap_hours'] < $first['gap_hours']);

        // Renders to readable bullet text.
        $text = app(WeeklyDigestService::class)->formatSlack($payload)['text'];
        $this->assertStringContainsString('• *Aman Shah*', $text);
        $this->assertStringContainsString('untracked', $text);
        $this->assertStringContainsString('late day', $text);
    }
}
