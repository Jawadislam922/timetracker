<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Services\SlackBotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

/**
 * Two attendance defects from Sana Khan's July 4 record:
 *   1. A clock-in left open past midnight let a SECOND clock-in through after
 *      the attendance day rolled over (guard was day-scoped) → orphaned clock-in.
 *   2. The shift-end auto clock-out was silent on Slack (only the "still working?"
 *      non-responder path announced), so it read as a missing clock-out.
 */
class OvernightClockGuardTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Mockery::close();
        parent::tearDown();
    }

    public function test_open_clock_in_from_last_night_blocks_a_new_clock_in_after_midnight(): void
    {
        $employee = User::factory()->create(['shift_start_time' => '09:00:00']);

        // Evening overtime clock-in, never clocked out (past shift end, so the
        // shift-end auto-close can't retroactively fire for it).
        Carbon::setTestNow(Carbon::parse('2026-07-04 19:26:00', 'Asia/Karachi'));
        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])
            ->assertOk();

        // Past midnight — a new attendance day. A second clock-in must be rejected.
        Carbon::setTestNow(Carbon::parse('2026-07-05 00:40:00', 'Asia/Karachi'));
        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])
            ->assertStatus(422)
            ->assertJsonPath('message', "You're already clocked in — clock out first.");

        // She CAN clock out — closing the still-open session cleanly.
        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_out'])
            ->assertOk();

        // Exactly one clock-in and one clock-out — no orphan, no double.
        $this->assertSame(1, TimeEntry::where('user_id', $employee->id)->where('action_type', 'clock_in')->count());
        $this->assertSame(1, TimeEntry::where('user_id', $employee->id)->where('action_type', 'clock_out')->count());
    }

    public function test_desktop_endpoint_also_blocks_the_duplicate_clock_in(): void
    {
        $employee = User::factory()->create(['shift_start_time' => '09:00:00']);
        \Laravel\Sanctum\Sanctum::actingAs($employee, ['desktop-tracker']);

        Carbon::setTestNow(Carbon::parse('2026-07-04 19:26:00', 'Asia/Karachi'));
        $this->postJson('/api/desktop/time-clock', ['action_type' => 'clock_in'])->assertStatus(201);

        Carbon::setTestNow(Carbon::parse('2026-07-05 00:40:00', 'Asia/Karachi'));
        // Desktop status shows Clock Out available (not a duplicate Clock In).
        $available = $this->getJson('/api/desktop/time-clock')->assertOk()->json('available');
        $this->assertContains('clock_out', $available);
        $this->assertNotContains('clock_in', $available);
        // And the act endpoint rejects a duplicate clock-in.
        $this->postJson('/api/desktop/time-clock', ['action_type' => 'clock_in'])->assertStatus(422);
    }

    public function test_shift_end_auto_close_announces_to_slack(): void
    {
        config(['services.attendance.clockin_channel' => 'C-ATTEND']);

        $spy = Mockery::spy(SlackBotService::class);
        $this->app->instance(SlackBotService::class, $spy);

        $employee = User::factory()->create(['shift_start_time' => '09:00:00']);

        // Clocked in at 09:00, never clocked out, not actively tracking.
        Carbon::setTestNow(Carbon::parse('2026-07-04 09:00:00', 'Asia/Karachi'));
        $this->actingAs($employee)
            ->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])
            ->assertOk();

        // After shift end (17:00) + buffer — run the auto-close command.
        Carbon::setTestNow(Carbon::parse('2026-07-04 18:00:00', 'Asia/Karachi'));
        $this->artisan('attendance:auto-clock-out', ['--user' => $employee->id])->assertSuccessful();

        // A real clock_out was written...
        $this->assertDatabaseHas('time_entries', [
            'user_id' => $employee->id,
            'action_type' => 'clock_out',
        ]);
        // ...and it was announced to Slack (was silent before this fix).
        $spy->shouldHaveReceived('postToChannel')
            ->withArgs(fn ($channel, $text) => $channel === 'C-ATTEND' && str_contains($text, 'automatically clocked out'))
            ->once();
    }
}
