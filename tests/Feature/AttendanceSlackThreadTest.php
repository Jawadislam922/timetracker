<?php

namespace Tests\Feature;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\AttendanceClockNotifier;
use App\Services\SlackBotService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Clock activity posts to Slack as one thread per person per day: clock-in is
 * the parent message; break-start, break-end, and clock-out reply under it.
 */
class AttendanceSlackThreadTest extends TestCase
{
    use RefreshDatabase;

    private function fakeSlack(): SlackBotService
    {
        $fake = new class extends SlackBotService
        {
            /** @var array<int, array{text: string, thread_ts: ?string}> */
            public array $calls = [];

            public function postToThread(string $channel, string $text, ?string $threadTs = null): ?string
            {
                $this->calls[] = ['text' => $text, 'thread_ts' => $threadTs];

                return 'ts-'.count($this->calls);
            }
        };

        $this->app->instance(SlackBotService::class, $fake);

        return $fake;
    }

    private function enableAttendancePosts(): void
    {
        MonitoringSetting::current()->update([
            'slack_clockin_enabled' => true,
            'slack_clockout_enabled' => true,
            'slack_attendance_channel' => '#attendance',
        ]);
    }

    private function entry(User $user, string $type, string $time, string $date = '2026-06-20'): TimeEntry
    {
        return TimeEntry::withoutEvents(fn () => TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => $type,
            'action_timestamp' => Carbon::parse("$date $time", 'Asia/Karachi'),
            'action_date' => $date,
            'action_time' => "$time:00",
        ]));
    }

    public function test_breaks_and_clock_out_reply_under_the_days_clock_in(): void
    {
        $this->enableAttendancePosts();
        $fake = $this->fakeSlack();
        $notifier = $this->app->make(AttendanceClockNotifier::class);
        $user = User::factory()->create(['name' => 'Aman']);

        $notifier->notify($this->entry($user, 'clock_in', '09:00'));
        $notifier->notify($this->entry($user, 'break_start', '13:00'));
        $notifier->notify($this->entry($user, 'break_end', '13:30'));
        $notifier->notify($this->entry($user, 'clock_out', '17:00'));

        $this->assertCount(4, $fake->calls);

        // Clock-in is the thread parent (no thread_ts).
        $this->assertNull($fake->calls[0]['thread_ts']);
        $this->assertStringContainsString('clocked in', $fake->calls[0]['text']);

        // The three later events all reply under the clock-in's ts.
        $this->assertSame('ts-1', $fake->calls[1]['thread_ts']);
        $this->assertSame('ts-1', $fake->calls[2]['thread_ts']);
        $this->assertSame('ts-1', $fake->calls[3]['thread_ts']);
        $this->assertStringContainsString('started a break', $fake->calls[1]['text']);
        $this->assertStringContainsString('ended their break', $fake->calls[2]['text']);
        $this->assertStringContainsString('clocked out', $fake->calls[3]['text']);
    }

    public function test_backfills_the_parent_when_clock_in_predates_the_feature(): void
    {
        $this->enableAttendancePosts();
        $fake = $this->fakeSlack();
        $notifier = $this->app->make(AttendanceClockNotifier::class);
        $user = User::factory()->create(['name' => 'Momal']);

        // The clock-in exists but was never announced (no slack_thread_ts) —
        // e.g. they clocked in before threading was switched on.
        $clockIn = $this->entry($user, 'clock_in', '09:00');
        $originalTs = $clockIn->action_timestamp->toDateTimeString();

        // Their break fires later: back-fill the clock-in parent, then reply.
        $notifier->notify($this->entry($user, 'break_start', '13:24'));

        $this->assertCount(2, $fake->calls);
        $this->assertNull($fake->calls[0]['thread_ts']);
        $this->assertStringContainsString('clocked in', $fake->calls[0]['text']);
        $this->assertSame('ts-1', $fake->calls[1]['thread_ts']);
        $this->assertStringContainsString('started a break', $fake->calls[1]['text']);

        // The back-fill wrote slack_thread_ts WITHOUT re-saving the model — a
        // model save would re-serialize the timestamp column and shift
        // action_timestamp 5h on a UTC MySQL server. Contract: id set, time kept.
        $clockIn->refresh();
        $this->assertSame('ts-1', $clockIn->slack_thread_ts);
        $this->assertSame($originalTs, $clockIn->action_timestamp->toDateTimeString());
    }

    public function test_nothing_posts_when_the_toggle_is_off(): void
    {
        // Channel set but posts disabled (the default).
        MonitoringSetting::current()->update(['slack_attendance_channel' => '#attendance']);
        $fake = $this->fakeSlack();
        $notifier = $this->app->make(AttendanceClockNotifier::class);
        $user = User::factory()->create();

        $notifier->notify($this->entry($user, 'clock_in', '09:00'));

        $this->assertCount(0, $fake->calls);
    }

    public function test_admin_edits_and_auto_clock_outs_are_skipped(): void
    {
        $this->enableAttendancePosts();
        $fake = $this->fakeSlack();
        $notifier = $this->app->make(AttendanceClockNotifier::class);
        $user = User::factory()->create();

        $admin = $this->entry($user, 'clock_in', '09:00');
        $admin->forceFill(['notes' => 'Admin clock edit'])->saveQuietly();
        $notifier->notify($admin);

        $auto = $this->entry($user, 'clock_out', '17:00');
        $auto->forceFill(['notes' => 'Auto clock-out: capped'])->saveQuietly();
        $notifier->notify($auto);

        $this->assertCount(0, $fake->calls);
    }
}
