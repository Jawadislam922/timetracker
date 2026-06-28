<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use App\Services\SlackBotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The "still working?" nudge fires only after the person's full shift has
 * elapsed, plus an optional minutes buffer (clockout_reminder_minutes). A 12h
 * shift is never pinged before 12h.
 */
class StillWorkingThresholdTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function fakeSlack(): SlackBotService
    {
        $fake = new class extends SlackBotService
        {
            public int $dms = 0;

            public function dmBlocksByEmail(string $email, string $text, array $blocks): bool
            {
                $this->dms++;

                return true;
            }
        };
        $this->app->instance(SlackBotService::class, $fake);

        return $fake;
    }

    private function clockIn(User $user, Carbon $at): void
    {
        TimeEntry::withoutEvents(fn () => TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => 'clock_in',
            'action_timestamp' => $at,
            'action_date' => $at->toDateString(),
            'action_time' => $at->toTimeString(),
        ]));
    }

    private function runAt(string $now): SlackBotService
    {
        config(['services.attendance.prompt_after_hours' => 8]);
        Carbon::setTestNow(Carbon::parse($now, 'Asia/Karachi'));

        return $this->fakeSlack();
    }

    public function test_no_nudge_before_the_shift_has_elapsed(): void
    {
        $fake = $this->runAt('2026-06-25 18:00:00');
        $user = User::factory()->create(['shift_hours' => 8.0, 'clockout_reminder_minutes' => null]);
        $this->clockIn($user, Carbon::parse('2026-06-25 16:00:00', 'Asia/Karachi')); // 2h in

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(0, $fake->dms);
        Carbon::setTestNow();
    }

    public function test_twelve_hour_shift_is_not_pinged_before_twelve_hours(): void
    {
        $fake = $this->runAt('2026-06-25 18:00:00');
        $user = User::factory()->create(['shift_hours' => 12.0]);
        $this->clockIn($user, Carbon::parse('2026-06-25 09:00:00', 'Asia/Karachi')); // 9h in

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(0, $fake->dms, 'a 12h shift must not be nudged at 9h');
        Carbon::setTestNow();
    }

    public function test_minutes_buffer_delays_the_nudge_past_shift_end(): void
    {
        // 8h shift + 20 min buffer = nudge only after 8h20m.
        $fake = $this->runAt('2026-06-25 18:00:00');
        $user = User::factory()->create(['shift_hours' => 8.0, 'clockout_reminder_minutes' => 20]);
        $this->clockIn($user, Carbon::parse('2026-06-25 09:50:00', 'Asia/Karachi')); // 8h10m in

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(0, $fake->dms, 'still within the 8h20m window');
        Carbon::setTestNow();
    }

    public function test_nudges_once_past_shift_plus_buffer(): void
    {
        $fake = $this->runAt('2026-06-25 18:00:00');
        $user = User::factory()->create(['shift_hours' => 8.0, 'clockout_reminder_minutes' => 20]);
        $this->clockIn($user, Carbon::parse('2026-06-25 09:30:00', 'Asia/Karachi')); // 8h30m in

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(1, $fake->dms, 'past 8h20m — should nudge');
        Carbon::setTestNow();
    }
}
