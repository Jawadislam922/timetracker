<?php

namespace Tests\Feature;

use App\Models\TimeEntry;
use App\Models\User;
use App\Services\SlackBotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The "still working?" nudge must never fire before the team default (or the
 * person's shift length). A stray low clockout_reminder_hours can't auto-close
 * someone an hour after they clock in.
 */
class StillWorkingThresholdTest extends TestCase
{
    use RefreshDatabase;

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

    public function test_low_reminder_does_not_nudge_before_the_floor(): void
    {
        config(['services.attendance.prompt_after_hours' => 8]);
        Carbon::setTestNow(Carbon::parse('2026-06-25 18:00:00', 'Asia/Karachi'));
        $fake = $this->fakeSlack();

        // Stray 1h reminder, 8h shift — clocked in only 2h ago.
        $user = User::factory()->create([
            'clockout_reminder_hours' => 1.0,
            'shift_hours' => 8.0,
            'shift_start_time' => '16:00:00',
        ]);
        $this->clockIn($user, Carbon::parse('2026-06-25 16:00:00', 'Asia/Karachi'));

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(0, $fake->dms, 'must not nudge only 2h in when the floor is 8h');

        Carbon::setTestNow();
    }

    public function test_genuinely_overdue_clock_in_still_gets_nudged(): void
    {
        config(['services.attendance.prompt_after_hours' => 8]);
        Carbon::setTestNow(Carbon::parse('2026-06-25 18:00:00', 'Asia/Karachi'));
        $fake = $this->fakeSlack();

        // Clocked in 9h ago, past the 8h floor, not actively tracking.
        $user = User::factory()->create(['clockout_reminder_hours' => 1.0]);
        $this->clockIn($user, Carbon::parse('2026-06-25 09:00:00', 'Asia/Karachi'));

        $this->artisan('attendance:still-working-check')->assertExitCode(0);

        $this->assertSame(1, $fake->dms, 'should still nudge once genuinely overdue');

        Carbon::setTestNow();
    }
}
