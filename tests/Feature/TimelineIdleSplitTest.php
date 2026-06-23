<?php

namespace Tests\Feature;

use App\Models\TrackingActivitySample;
use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

/**
 * A session that idle-pauses and resumes should render as TWO Timeline blocks
 * (the resumed run starts at the resume time), not one merged block — while a
 * gap-free session stays a single block.
 */
class TimelineIdleSplitTest extends TestCase
{
    use RefreshDatabase;

    private function sample(TrackingSession $s, Carbon $at, int $mouse = 200): void
    {
        TrackingActivitySample::create([
            'tracking_session_id' => $s->id,
            'user_id' => $s->user_id,
            'captured_at' => $at,
            'keyboard_count' => 5,
            'mouse_count' => $mouse,
            'idle_seconds' => 0,
        ]);
    }

    public function test_idle_gap_splits_session_into_two_blocks(): void
    {
        $user = User::factory()->create();
        $tz = config('app.timezone');
        $day = '2026-06-23';

        $session = TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-split',
            'started_at' => Carbon::parse("$day 09:00:00", $tz),
            'stopped_at' => Carbon::parse("$day 09:13:00", $tz),
            'total_seconds' => 480, // 8 active minutes across the two runs
            'status' => 'stopped',
            'source' => 'desktop',
        ]);

        // Run 1: 09:00–09:04 (samples every 10s). Then a 7-minute idle gap.
        for ($t = Carbon::parse("$day 09:00:00", $tz); $t->lte(Carbon::parse("$day 09:04:00", $tz)); $t->addSeconds(10)) {
            $this->sample($session, $t->copy());
        }
        // Run 2: 09:11–09:13 (resumed after the gap).
        for ($t = Carbon::parse("$day 09:11:00", $tz); $t->lte(Carbon::parse("$day 09:13:00", $tz)); $t->addSeconds(10)) {
            $this->sample($session, $t->copy());
        }

        TrackingScreenshot::create(['tracking_session_id' => $session->id, 'user_id' => $user->id, 'captured_at' => Carbon::parse("$day 09:02:00", $tz), 'image_path' => 'a.jpg']);
        TrackingScreenshot::create(['tracking_session_id' => $session->id, 'user_id' => $user->id, 'captured_at' => Carbon::parse("$day 09:12:00", $tz), 'image_path' => 'b.jpg']);

        $this->actingAs($user)
            ->get("/timeline?date=$day")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('initialData.sessions', 2)
                ->where('initialData.sessions.0.is_resumed', false)
                ->where('initialData.sessions.1.is_resumed', true)
                // Second block starts at the resume time, not the session start.
                ->where('initialData.sessions.1.started_at', fn ($iso) => str_contains((string) $iso, '09:11'))
                ->where('initialData.sessions.1.idle_before_seconds', fn ($v) => (int) $v >= 6 * 60)
                // Each block carries its own screenshot.
                ->has('initialData.sessions.0.screenshots', 1)
                ->has('initialData.sessions.1.screenshots', 1)
                // Day total is unchanged by the display split.
                ->where('initialData.totals.day', 480)
            );
    }

    public function test_gap_free_session_stays_one_block(): void
    {
        $user = User::factory()->create();
        $tz = config('app.timezone');
        $day = '2026-06-23';

        $session = TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-nogap',
            'started_at' => Carbon::parse("$day 10:00:00", $tz),
            'stopped_at' => Carbon::parse("$day 10:05:00", $tz),
            'total_seconds' => 300,
            'status' => 'stopped',
            'source' => 'desktop',
        ]);
        for ($t = Carbon::parse("$day 10:00:00", $tz); $t->lte(Carbon::parse("$day 10:05:00", $tz)); $t->addSeconds(10)) {
            $this->sample($session, $t->copy());
        }

        $this->actingAs($user)
            ->get("/timeline?date=$day")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('initialData.sessions', 1)
                ->where('initialData.sessions.0.is_resumed', false)
            );
    }
}
