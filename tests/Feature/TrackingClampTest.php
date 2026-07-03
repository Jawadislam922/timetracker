<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\Desktop\SessionController;
use App\Models\TrackingSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * The server clamps a session's total_seconds to its real elapsed wall-clock,
 * so the desktop double-timer bug can never store impossible tracked time; and
 * the repair command corrects rows already inflated.
 */
class TrackingClampTest extends TestCase
{
    use RefreshDatabase;

    private function clamp(TrackingSession $s, int $incoming, Carbon $endAt): int
    {
        $controller = app(SessionController::class);
        $method = new ReflectionMethod($controller, 'clampTotalSeconds');
        $method->setAccessible(true);

        return $method->invoke($controller, $s, $incoming, $endAt);
    }

    public function test_impossible_total_is_clamped_to_elapsed(): void
    {
        $start = Carbon::parse('2026-07-03 08:00:00', 'Asia/Karachi');
        $s = new TrackingSession(['started_at' => $start, 'user_id' => 1, 'device_name' => 'PC-BD-1', 'app_version' => '0.4.1']);
        $end = $start->copy()->addHours(6); // 6h = 21600s elapsed

        // Desktop reports 9.79h (35228s) into a 6h window — impossible → clamp.
        $this->assertSame(21600, $this->clamp($s, 35228, $end));
    }

    public function test_legitimate_total_is_left_untouched(): void
    {
        $start = Carbon::parse('2026-07-03 08:00:00', 'Asia/Karachi');
        $s = new TrackingSession(['started_at' => $start, 'user_id' => 1]);
        $end = $start->copy()->addHours(6);

        // Real active time 5h (idle excluded) is below elapsed — unchanged.
        $this->assertSame(18000, $this->clamp($s, 18000, $end));
        // Boundary (== elapsed) and small grace are also fine.
        $this->assertSame(21600, $this->clamp($s, 21600, $end));
        $this->assertSame(21601, $this->clamp($s, 21601, $end));
    }

    public function test_repair_command_clamps_only_inflated_rows_and_backs_up(): void
    {
        $u = User::factory()->create();
        $start = Carbon::parse('2026-07-03 08:00:00', 'Asia/Karachi');

        $bad = TrackingSession::create([
            'user_id' => $u->id, 'client_uuid' => 'bad-1',
            'started_at' => $start, 'stopped_at' => $start->copy()->addHours(6),
            'total_seconds' => 36000, 'status' => 'stopped', 'source' => 'desktop', // 10h in 6h
        ]);
        $good = TrackingSession::create([
            'user_id' => $u->id, 'client_uuid' => 'good-1',
            'started_at' => $start, 'stopped_at' => $start->copy()->addHours(6),
            'total_seconds' => 18000, 'status' => 'stopped', 'source' => 'desktop', // 5h in 6h
        ]);

        // Dry run: reports but changes nothing.
        $this->artisan('tracking:repair-inflated')->assertExitCode(0);
        $this->assertSame(36000, (int) $bad->fresh()->total_seconds);

        // Apply: clamp the inflated one to elapsed, leave the healthy one alone.
        $this->artisan('tracking:repair-inflated --apply')->assertExitCode(0);
        $this->assertSame(21600, (int) $bad->fresh()->total_seconds);
        $this->assertSame(18000, (int) $good->fresh()->total_seconds);
    }
}
