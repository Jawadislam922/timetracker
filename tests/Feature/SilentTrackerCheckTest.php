<?php

namespace Tests\Feature;

use App\Models\TrackingSession;
use App\Models\User;
use App\Services\SlackBotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

/**
 * The capture-health watchdog must NOT alert for an auto-paused tracker (which
 * legitimately captures nothing) — only for one that is working (total_seconds
 * advancing) but capturing nothing (likely an antivirus block).
 */
class SilentTrackerCheckTest extends TestCase
{
    use RefreshDatabase;

    private function silentSession(int $totalSeconds): TrackingSession
    {
        $user = User::factory()->create();

        // Active, running 30 min, live heartbeat, NO screenshots/samples.
        return TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-silent-'.$user->id,
            'started_at' => Carbon::now('Asia/Karachi')->subMinutes(30),
            'last_heartbeat_at' => Carbon::now('Asia/Karachi'),
            'total_seconds' => $totalSeconds,
            'status' => TrackingSession::STATUS_ACTIVE,
            'source' => 'desktop',
            'device_name' => 'PC-TEST',
        ]);
    }

    public function test_paused_tracker_frozen_total_is_not_alerted(): void
    {
        config(['services.attendance.tracker_health_channel' => '#health']);
        $slack = $this->spy(SlackBotService::class);

        $session = $this->silentSession(1000);

        // First run records a baseline; second run sees the SAME total (frozen
        // = paused) → must never alert.
        Artisan::call('monitoring:silent-tracker-check');
        Artisan::call('monitoring:silent-tracker-check');

        $slack->shouldNotHaveReceived('postToChannel');
        $this->assertNull($session->fresh()->health_alerted_at);
    }

    public function test_working_but_capturing_nothing_is_alerted(): void
    {
        config(['services.attendance.tracker_health_channel' => '#health']);
        $slack = $this->spy(SlackBotService::class);

        $session = $this->silentSession(1000);

        // Baseline.
        Artisan::call('monitoring:silent-tracker-check');
        // total_seconds advanced (working) but still no captures → AV block.
        $session->update(['total_seconds' => 2000]);
        Artisan::call('monitoring:silent-tracker-check');

        $slack->shouldHaveReceived('postToChannel')->once();
        $this->assertNotNull($session->fresh()->health_alerted_at);
    }
}
