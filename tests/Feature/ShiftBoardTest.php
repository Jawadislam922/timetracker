<?php

namespace Tests\Feature;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The dashboard Shift Board groups the active tracking team by shift band and
 * classifies each person's clock state for the day, carry-over aware so the
 * night team that crossed midnight still reads "still clocked in".
 */
class ShiftBoardTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'permissions' => ['attendance.view', 'attendance.edit_times'],
            'tracks_time' => false,
        ]);
    }

    /** Find a member across all bands; returns the row plus its band key. */
    private function member(array $board, int $userId): ?array
    {
        foreach ($board['bands'] as $band) {
            foreach ($band['members'] as $m) {
                if ($m['user_id'] === $userId) {
                    return $m + ['_band' => $band['key']];
                }
            }
        }

        return null;
    }

    public function test_evening_clock_in_carried_past_midnight_reads_still_in(): void
    {
        $manager = $this->manager();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_hours' => 9, 'tracks_time' => true,
        ]);

        // Clocked in late evening, never clocked out.
        Carbon::setTestNow(Carbon::parse('2026-06-09 21:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])->assertOk();

        // Next morning — a new attendance day for a 09:00 shift.
        Carbon::setTestNow(Carbon::parse('2026-06-10 09:30:00', 'Asia/Karachi'));
        $board = $this->actingAs($manager)->getJson(route('time-entries.today-summary'))->assertOk()->json('shift_board');

        $m = $this->member($board, $emp->id);
        $this->assertNotNull($m, 'employee should appear on the board');
        $this->assertSame('still_in', $m['status']);
        $this->assertSame('red', $m['severity']);
        $this->assertSame('day', $m['_band']);
        $this->assertTrue($m['can_clock_out']);
        $this->assertNotNull($m['suggested_clock_out']);

        Carbon::setTestNow();
    }

    public function test_not_clocked_in_after_shift_start_reads_not_in_yet(): void
    {
        $manager = $this->manager();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'shift_grace_minutes' => 0, 'tracks_time' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-10 10:00:00', 'Asia/Karachi'));
        $board = $this->actingAs($manager)->getJson(route('time-entries.today-summary'))->assertOk()->json('shift_board');

        $m = $this->member($board, $emp->id);
        $this->assertNotNull($m);
        $this->assertSame('not_in_yet', $m['status']);
        $this->assertSame('amber', $m['severity']);
        $this->assertSame('day', $m['_band']);
        $this->assertFalse($m['can_clock_out']);

        Carbon::setTestNow();
    }

    public function test_one_day_shift_override_moves_the_worker_to_the_override_band(): void
    {
        $manager = $this->manager();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '09:00:00', 'tracks_time' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-10 12:00:00', 'Asia/Karachi'));
        $today = $emp->attendanceDateFor(Carbon::now('Asia/Karachi'));
        // One-day override moves a standing Day worker (09:00) to a 02:00 start.
        $emp->shiftOverrides()->create(['date' => $today, 'shift_start_time' => '02:00:00', 'reason' => 'test']);

        $board = $this->actingAs($manager)->getJson(route('time-entries.today-summary'))->assertOk()->json('shift_board');
        $m = $this->member($board, $emp->id);
        $this->assertNotNull($m);
        // Band + shown start follow the override (Night), not the standing 09:00 (Day).
        $this->assertSame('night', $m['_band']);
        $this->assertSame('02:00', $m['shift_start']);

        Carbon::setTestNow();
    }

    public function test_evening_worker_groups_in_evening_band_and_reads_working(): void
    {
        $manager = $this->manager();
        $emp = User::factory()->create([
            'role' => 'member', 'permissions' => [],
            'shift_start_time' => '16:00:00', 'tracks_time' => true,
        ]);

        Carbon::setTestNow(Carbon::parse('2026-06-10 17:00:00', 'Asia/Karachi'));
        $this->actingAs($emp)->postJson(route('time-entries.store'), ['action_type' => 'clock_in'])->assertOk();

        $board = $this->actingAs($manager)->getJson(route('time-entries.today-summary'))->assertOk()->json('shift_board');

        $m = $this->member($board, $emp->id);
        $this->assertNotNull($m);
        $this->assertSame('evening', $m['_band']);
        $this->assertSame('working', $m['status']);

        Carbon::setTestNow();
    }
}
