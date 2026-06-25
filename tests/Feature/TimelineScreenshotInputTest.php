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
 * Each Timeline screenshot reports the keystrokes + real mouse clicks summed
 * from the per-minute activity samples in the window since the previous shot.
 */
class TimelineScreenshotInputTest extends TestCase
{
    use RefreshDatabase;

    public function test_screenshot_shows_aggregated_keystrokes_and_clicks(): void
    {
        $user = User::factory()->create();
        $tz = config('app.timezone');
        $day = '2026-06-23';

        $session = TrackingSession::create([
            'user_id' => $user->id, 'client_uuid' => 'uuid-input',
            'started_at' => Carbon::parse("$day 10:00:00", $tz),
            'stopped_at' => Carbon::parse("$day 10:20:00", $tz),
            'total_seconds' => 1200, 'status' => 'stopped', 'source' => 'desktop',
        ]);

        // A sample every minute 10:01–10:19 with 10 keys + 2 clicks each.
        for ($m = 1; $m <= 19; $m++) {
            TrackingActivitySample::create([
                'tracking_session_id' => $session->id, 'user_id' => $user->id,
                'captured_at' => Carbon::parse("$day 10:".str_pad($m, 2, '0', STR_PAD_LEFT).":00", $tz),
                'keyboard_count' => 10, 'mouse_count' => 99, 'mouse_clicks' => 2, 'idle_seconds' => 0,
            ]);
        }

        // Shot A at 10:05 → samples 10:01–10:05 (5) → 50 keys, 10 clicks.
        // Shot B at 10:15 → samples 10:06–10:15 (10) → 100 keys, 20 clicks.
        TrackingScreenshot::create(['tracking_session_id' => $session->id, 'user_id' => $user->id, 'captured_at' => Carbon::parse("$day 10:05:00", $tz), 'image_path' => 'a.jpg']);
        TrackingScreenshot::create(['tracking_session_id' => $session->id, 'user_id' => $user->id, 'captured_at' => Carbon::parse("$day 10:15:00", $tz), 'image_path' => 'b.jpg']);

        $this->actingAs($user)
            ->get("/timeline?date=$day")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->has('initialData.sessions.0.screenshots', 2)
                ->where('initialData.sessions.0.screenshots.0.keystrokes', 50)
                ->where('initialData.sessions.0.screenshots.0.clicks', 10)
                ->where('initialData.sessions.0.screenshots.1.keystrokes', 100)
                ->where('initialData.sessions.0.screenshots.1.clicks', 20)
            );
    }
}
