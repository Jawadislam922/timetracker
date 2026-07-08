<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Support\TrackerHealthDiagnostics;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * The capture-health watchdog must never cry "antivirus block" at someone who
 * is simply on break — the reported Asim Khan false alarm, where the desktop
 * kept the tracked-seconds counter advancing during his break.
 */
class SilentTrackerBreakAwareTest extends TestCase
{
    use RefreshDatabase;

    private function silentAdvancingSession(User $user): TrackingSession
    {
        // Live, running 45 min, timer advanced 1000s since the last probe, but
        // zero screenshots/samples → looks exactly like an AV block.
        return TrackingSession::create([
            'user_id' => $user->id,
            'client_uuid' => 'uuid-'.$user->id,
            'device_name' => 'PC-CW-2',
            'source' => 'desktop',
            'status' => TrackingSession::STATUS_ACTIVE,
            'started_at' => now()->subMinutes(45),
            'last_heartbeat_at' => now()->subMinute(),
            'total_seconds' => 2700,
            'health_probe_seconds' => 1700,
        ]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-07-08 20:45:00', 'Asia/Karachi'));
        File::deleteDirectory(TrackerHealthDiagnostics::dir());
    }

    protected function tearDown(): void
    {
        File::deleteDirectory(TrackerHealthDiagnostics::dir());
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_no_av_alert_while_on_break(): void
    {
        $user = User::factory()->create(['shift_start_time' => '16:00:00']);
        TimeEntry::create(['user_id' => $user->id, 'action_type' => 'clock_in', 'action_timestamp' => now()->subHours(2), 'action_date' => '2026-07-08', 'action_time' => now()->subHours(2)->toTimeString()]);
        TimeEntry::create(['user_id' => $user->id, 'action_type' => 'break_start', 'action_timestamp' => now()->subMinutes(27), 'action_date' => '2026-07-08', 'action_time' => now()->subMinutes(27)->toTimeString()]);
        $session = $this->silentAdvancingSession($user);

        $this->artisan('monitoring:silent-tracker-check', ['--minutes' => 20])->assertExitCode(0);

        $this->assertNull($session->fresh()->health_alerted_at, 'a person on break must never be AV-alerted');
        $files = File::isDirectory(TrackerHealthDiagnostics::dir()) ? File::files(TrackerHealthDiagnostics::dir()) : [];
        $this->assertNotEmpty($files, 'the on-break skip should still capture a diagnostic');
        $snap = json_decode(File::get($files[0]->getPathname()), true);
        $this->assertStringContainsString('on break', $snap['decision']);
    }

    public function test_still_alerts_when_actually_working_but_not_capturing(): void
    {
        $user = User::factory()->create(['shift_start_time' => '16:00:00']);
        // Clocked in, NOT on break → a genuine silent tracker (AV block).
        TimeEntry::create(['user_id' => $user->id, 'action_type' => 'clock_in', 'action_timestamp' => now()->subHours(2), 'action_date' => '2026-07-08', 'action_time' => now()->subHours(2)->toTimeString()]);
        $session = $this->silentAdvancingSession($user);

        $this->artisan('monitoring:silent-tracker-check', ['--minutes' => 20])->assertExitCode(0);

        $this->assertNotNull($session->fresh()->health_alerted_at, 'a working-but-blocked tracker must still alert');
    }
}
