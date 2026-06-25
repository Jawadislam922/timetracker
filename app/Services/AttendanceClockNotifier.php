<?php

namespace App\Services;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;

/**
 * Posts attendance clock activity to Slack as ONE thread per person per day:
 * the day's first clock-in is the parent message, and break-start, break-end,
 * and clock-out (plus any later clock-in after lunch) post as replies under it.
 *
 * Gating mirrors the existing toggles: clock-in and breaks follow the clock-in
 * toggle (they're presence events), clock-out follows the clock-out toggle. The
 * system's own auto clock-outs and admin clock-time edits are skipped — the
 * former posts its own worded lockout message, the latter is a back-dated edit.
 */
class AttendanceClockNotifier
{
    public function __construct(private SlackBotService $slack) {}

    public function notify(TimeEntry $entry): void
    {
        if (! in_array($entry->action_type, ['clock_in', 'clock_out', 'break_start', 'break_end'], true)) {
            return;
        }

        // Back-dated admin edits aren't someone clocking in/out right now.
        if (str_starts_with((string) $entry->notes, 'Admin clock edit')) {
            return;
        }

        // The auto clock-out path posts its own lockout message; don't double up.
        if ($entry->action_type === 'clock_out'
            && str_starts_with((string) $entry->notes, 'Auto clock-out')) {
            return;
        }

        $settings = MonitoringSetting::current();
        $channel = $settings->attendanceChannel();
        if (! $channel) {
            return;
        }

        $enabled = match ($entry->action_type) {
            'clock_in', 'break_start', 'break_end' => (bool) $settings->slack_clockin_enabled,
            'clock_out' => (bool) $settings->slack_clockout_enabled,
            default => false,
        };
        if (! $enabled) {
            return;
        }

        $threadTs = $this->dayThreadTs($entry);
        $text = $this->message($entry);

        // First clock-in of the day with no thread yet → start the thread.
        if ($entry->action_type === 'clock_in' && $threadTs === null) {
            $ts = $this->slack->postToThread($channel, $text);
            if ($ts) {
                $entry->forceFill(['slack_thread_ts' => $ts])->saveQuietly();
            }

            return;
        }

        // Everything else replies under the day's thread (or posts standalone if
        // the parent clock-in wasn't announced, e.g. clock-in posts disabled).
        $this->slack->postToThread($channel, $text, $threadTs);
    }

    /** The parent Slack message ts for this user's attendance day, if any. */
    private function dayThreadTs(TimeEntry $entry): ?string
    {
        return TimeEntry::query()
            ->where('user_id', $entry->user_id)
            ->where('action_date', $entry->action_date)
            ->whereNotNull('slack_thread_ts')
            ->orderBy('action_timestamp')->orderBy('id')
            ->value('slack_thread_ts');
    }

    private function message(TimeEntry $entry): string
    {
        $at = $entry->action_timestamp->copy()->setTimezone('Asia/Karachi')->format('g:i A');
        $name = $entry->user->name ?? 'Someone';

        return match ($entry->action_type) {
            'clock_in' => sprintf(':office: *%s* clocked in at %s.', $name, $at),
            'break_start' => sprintf(':coffee: *%s* started a break at %s.', $name, $at),
            'break_end' => sprintf(':back: *%s* ended their break at %s.', $name, $at),
            'clock_out' => sprintf(':waving_black_flag: *%s* clocked out at %s.%s', $name, $at, $this->workedSuffix($entry)),
            default => sprintf('*%s* — %s at %s.', $name, $entry->action_type, $at),
        };
    }

    /**
     * " (worked 8h 12m)" for a clock-out, from the matching clock-in on the same
     * attendance day, or '' when it can't be determined cheaply.
     */
    private function workedSuffix(TimeEntry $clockOut): string
    {
        $clockIn = TimeEntry::query()
            ->where('user_id', $clockOut->user_id)
            ->where('action_type', 'clock_in')
            ->where('action_timestamp', '<=', $clockOut->action_timestamp)
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->first();

        if (! $clockIn) {
            return '';
        }

        $mins = $clockIn->action_timestamp->diffInMinutes($clockOut->action_timestamp);
        if ($mins <= 0) {
            return '';
        }

        return $mins >= 60
            ? sprintf(' (worked %dh %dm)', intdiv($mins, 60), $mins % 60)
            : sprintf(' (worked %dm)', $mins);
    }
}
