<?php

namespace App\Console\Commands;

use App\Models\AttendanceClockCheck;
use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Services\AttendanceCloser;
use App\Services\SlackBotService;
use App\Support\BusinessTime;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Safety net for forgotten clock-outs.
 *
 * The desktop/web clock is fully manual — it only records the action the user
 * presses. If someone clocks in and never clocks out (closed the app, slept the
 * laptop, or simply forgot), the clock-in hangs open forever: they read as
 * "Working" indefinitely and the day never closes. This closes those dangling
 * clock-ins and writes a real clock_out entry with a plain-language REASON.
 *
 * Close time, in order:
 *   1. Forgotten / not actively tracking -> the person's SHIFT END plus a grace
 *      buffer (default 20m). In-office then reflects the scheduled day, not a
 *      flat 12h, so "Working: 22h" can't happen.
 *   2. Tracked overtime past shift end -> the tracker's last real activity, so
 *      genuine late work is still credited. A live tracker (idle < idle-hours)
 *      is left alone — we never cut someone off mid-overtime.
 *   3. Absolute backstop -> never beyond clock-in + hard-cap-hours, so there are
 *      no multi-day ghosts even for an always-on tracker.
 * Shift end is resolved per attendance day via User::effectiveShiftFor(), so a
 * one-day shift override is honoured automatically.
 */
class AutoCloseAttendance extends Command
{
    protected $signature = 'attendance:auto-clock-out
        {--buffer-minutes= : Grace minutes after shift end before a forgotten clock-out closes (default from config)}
        {--hard-cap-hours= : Absolute max hours a clock-in may span, even while tracking (default from config)}
        {--idle-hours=2 : A tracker quiet this many hours counts as "stopped" (overtime ended)}
        {--user= : Limit to a single user id (for testing)}
        {--dry-run : Report what would be closed without writing anything}';

    protected $description = 'Auto clock-out dangling attendance clock-ins (forgotten clock-outs), recording a reason.';

    public function handle(AttendanceCloser $closer, SlackBotService $slack): int
    {
        $bufferMinutes = $this->option('buffer-minutes') !== null
            ? (int) $this->option('buffer-minutes')
            : (int) config('services.attendance.auto_close_buffer_minutes', 20);
        $hardCapHours = $this->option('hard-cap-hours') !== null
            ? (float) $this->option('hard-cap-hours')
            : (float) config('services.attendance.auto_close_hard_cap_hours', 16);
        $idleHours = (float) $this->option('idle-hours');
        $defaultHours = (float) config('services.attendance.prompt_after_hours', 8);
        $dry = (bool) $this->option('dry-run');
        $now = Carbon::now(BusinessTime::tz());

        $users = User::query()
            ->when($this->option('user'), fn ($q) => $q->where('id', $this->option('user')))
            ->get();

        $closed = 0;
        $skipped = 0;

        foreach ($users as $user) {
            $last = TimeEntry::where('user_id', $user->id)
                ->orderByDesc('action_timestamp')->orderByDesc('id')
                ->first();

            // Only act on an OPEN session: latest action is a clock-in, an
            // unfinished break (break_start), or working again after a break
            // (break_end). A worker who resumed from a break and then forgot to
            // clock out is still on the clock and must be auto-closed too.
            if (! $last || ! in_array($last->action_type, ['clock_in', 'break_start', 'break_end'], true)) {
                continue;
            }

            // The clock-in that started this open session.
            $clockIn = TimeEntry::where('user_id', $user->id)
                ->where('action_type', 'clock_in')
                ->orderByDesc('action_timestamp')->orderByDesc('id')
                ->first();
            if (! $clockIn) {
                continue; // open break with no clock-in — malformed, leave it
            }

            // If they explicitly confirmed "still working" in Slack and the
            // snooze hasn't expired, trust them and don't force-close.
            $check = AttendanceClockCheck::where('clock_in_id', $clockIn->id)->first();
            if ($check && $check->confirmed_until && $check->confirmed_until->isFuture()) {
                $skipped++;
                continue;
            }

            // The worker's own timezone defines their shift boundaries; a 9am
            // shift for a New York VA must end relative to 9am New York, not
            // Karachi. Defaults to Asia/Karachi, so local staff are unchanged.
            $tz = $user->workTimezone();

            $clockInTs = Carbon::parse($clockIn->action_timestamp)->setTimezone($tz);
            $clockInDate = $clockIn->action_date instanceof Carbon
                ? $clockIn->action_date->toDateString()
                : (string) $clockIn->action_date;

            // The person's shift for THIS attendance day (one-day override aware).
            $shift = $user->effectiveShiftFor($clockInDate);
            $shiftHours = $shift['hours'] ?? $defaultHours;

            // Scheduled shift end for the day. With a known start time it anchors
            // to the schedule (a late arrival still ends at shift end, not a full
            // shift later); without one it's a full shift from the clock-in.
            $shiftEnd = $shift['start_time']
                ? Carbon::parse($clockInDate.' '.$shift['start_time']->format('H:i:s'), $tz)
                    ->addMinutes((int) round($shiftHours * 60))
                : $clockInTs->copy()->addMinutes((int) round($shiftHours * 60));

            // Close a forgotten clock-out at shift end + buffer (or clock-in +
            // buffer if they somehow clocked in after their own shift ended).
            $baseClose = ($shiftEnd->greaterThan($clockInTs) ? $shiftEnd->copy() : $clockInTs->copy())
                ->addMinutes($bufferMinutes);
            $hardCapAt = $clockInTs->copy()->addMinutes((int) round($hardCapHours * 60));

            // Day isn't over yet — leave them clocked in.
            if ($now->lessThan($baseClose)) {
                $skipped++;
                continue;
            }

            // A live tracker past shift end means genuine overtime: don't cut it,
            // wait until it goes quiet (the hard cap is the final backstop). When
            // it has stopped, credit the time up to its last real activity.
            $lastSig = $this->lastTrackerSignal($user->id, $clockInTs);
            $trackerActive = $lastSig && $lastSig->greaterThanOrEqualTo($now->copy()->subHours($idleHours));
            if ($trackerActive && $now->lessThan($hardCapAt)) {
                $skipped++;
                continue;
            }

            $closeAt = $baseClose->copy();
            if ($lastSig && $lastSig->greaterThan($closeAt)) {
                $closeAt = $lastSig->copy(); // tracked overtime past the buffer
            }
            if ($closeAt->greaterThan($hardCapAt)) {
                $closeAt = $hardCapAt->copy();
            }

            $reason = $closeAt->equalTo($hardCapAt)
                ? sprintf('Auto clock-out: no manual clock-out; capped at %dh maximum.', (int) round($hardCapHours))
                : sprintf('Auto clock-out: no manual clock-out; closed at shift end + %dm.', $bufferMinutes);

            $spanHours = $clockInTs->diffInMinutes($closeAt, false) / 60;
            $this->line(sprintf(
                '%-22s clock-in %s -> %s clock-out (%s) %s',
                $user->name,
                $clockInTs->format('M j g:i A'),
                $closeAt->format('M j g:i A'),
                $this->humanHours($spanHours),
                $dry ? '[dry-run]' : ''
            ));
            $this->line('    reason: '.$reason);

            if (! $dry) {
                $closer->close($user->id, $closeAt, $reason);
                AttendanceClockCheck::where('clock_in_id', $clockIn->id)
                    ->whereNull('resolved_at')
                    ->update(['resolved_at' => $now, 'resolution' => 'closed_elsewhere']);
                // Announce to Slack, same as the "still working?" non-responder
                // close does — otherwise a shift-end auto clock-out is silent and
                // reads as a missing clock-out to managers. (The clock notifier
                // deliberately skips Auto-clock-out entries so we post here.)
                $this->announceLockout($slack, $user, $closeAt, $reason, $clockIn->action_date);
            }
            $closed++;
        }

        $this->info(sprintf('%s %d open clock-in(s); skipped %d still-active.', $dry ? 'Would close' : 'Closed', $closed, $skipped));

        return self::SUCCESS;
    }

    /**
     * Tell the team channel that someone was auto clocked-out at shift end, and
     * why — mirrors StillWorkingCheck::announceLockout so both auto-close paths
     * announce identically. Time shown in the business timezone the channel reads.
     */
    private function announceLockout(SlackBotService $slack, User $user, Carbon $at, string $reason, ?string $actionDate = null): void
    {
        $channel = config('services.attendance.lockout_channel')
            ?: config('services.attendance.clockin_channel');
        if (! $channel) {
            return;
        }

        $message = sprintf(
            ":lock: *%s* was automatically clocked out at %s.\n> %s",
            $user->name,
            $at->copy()->setTimezone(BusinessTime::tz())->format('g:i A'),
            $reason,
        );

        // Post under the person's own clock-in thread for the day when one
        // exists, so a manager reading the channel sees one thread per person
        // per day instead of loose lockout messages between everyone's events.
        $threadTs = $actionDate
            ? \App\Services\AttendanceClockNotifier::dayThreadTs($user->id, $actionDate)
            : null;

        if ($threadTs) {
            $slack->postToThread($channel, $message, $threadTs);
        } else {
            $slack->postToChannel($channel, $message);
        }
    }

    /**
     * Most recent tracker activity (heartbeat / stop / start) during the open
     * session, or null if never tracked. Computed in PHP so it's portable across
     * MySQL and the SQLite test database (no GREATEST()).
     */
    private function lastTrackerSignal(int $userId, Carbon $clockInTs): ?Carbon
    {
        $sessions = TrackingSession::where('user_id', $userId)
            ->where(function ($q) use ($clockInTs) {
                $q->where('last_heartbeat_at', '>=', $clockInTs)
                    ->orWhere('stopped_at', '>=', $clockInTs)
                    ->orWhere('started_at', '>=', $clockInTs);
            })
            ->get(['started_at', 'last_heartbeat_at', 'stopped_at']);

        $latest = null;
        foreach ($sessions as $session) {
            foreach ([$session->last_heartbeat_at, $session->stopped_at, $session->started_at] as $ts) {
                if ($ts === null) {
                    continue;
                }
                $candidate = Carbon::parse($ts)->setTimezone(BusinessTime::tz());
                if ($latest === null || $candidate->greaterThan($latest)) {
                    $latest = $candidate;
                }
            }
        }

        return $latest;
    }

    private function humanHours(float $hours): string
    {
        $mins = max(0, (int) round($hours * 60));

        return $mins >= 60 ? sprintf('%dh %dm', intdiv($mins, 60), $mins % 60) : $mins.'m';
    }
}
