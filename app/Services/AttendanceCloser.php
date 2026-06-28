<?php

namespace App\Services;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Closes an open attendance clock-in by writing a real clock_out (and a
 * break_end first if the person was on break) with a plain-language reason.
 * Shared by the auto-clock-out cap command, the Slack still-working check, and
 * the Slack "clock me out" button so the closing rules live in one place.
 */
class AttendanceCloser
{
    public function __construct(private TrackingSessionService $sessions) {}

    /**
     * Close the user's currently-open clock-in at $closeAt with $reason.
     * Returns the clock_out entry, or null if there was nothing open.
     * $closeAt is clamped to never predate the clock-in.
     */
    public function close(int $userId, Carbon $closeAt, string $reason): ?TimeEntry
    {
        $last = TimeEntry::where('user_id', $userId)
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->first();

        if (! $last || ! in_array($last->action_type, ['clock_in', 'break_start'], true)) {
            return null; // already closed / nothing open
        }

        // Reuse $last when it already IS the clock-in; only re-query when the open
        // state is a break (then the clock-in is an earlier row).
        $clockIn = $last->action_type === 'clock_in'
            ? $last
            : TimeEntry::where('user_id', $userId)
                ->where('action_type', 'clock_in')
                ->orderByDesc('action_timestamp')->orderByDesc('id')
                ->first();

        if (! $clockIn) {
            return null;
        }

        // $closeAt may arrive in the worker's timezone (auto-close computes shift
        // end there); store it in the app timezone so the canonical instant
        // round-trips and action_time == TIME(action_timestamp).
        $closeAt = $closeAt->copy()->setTimezone(config('app.timezone', 'Asia/Karachi'));

        $clockInTs = Carbon::parse($clockIn->action_timestamp)->setTimezone(config('app.timezone', 'Asia/Karachi'));
        if ($closeAt->lessThanOrEqualTo($clockInTs)) {
            $closeAt = $clockInTs->copy()->addMinute();
        }

        $date = $clockIn->action_date instanceof Carbon
            ? $clockIn->action_date->toDateString()
            : (string) $clockIn->action_date;

        $clockOut = DB::transaction(function () use ($last, $clockIn, $closeAt, $date, $reason) {
            if ($last->action_type === 'break_start') {
                TimeEntry::create([
                    'user_id' => $clockIn->user_id,
                    'action_type' => 'break_end',
                    'action_timestamp' => $closeAt,
                    'action_date' => $date,
                    'action_time' => $closeAt->toTimeString(),
                    'notes' => 'Auto break-end (system close).',
                ]);
            }

            return TimeEntry::create([
                'user_id' => $clockIn->user_id,
                'action_type' => 'clock_out',
                'action_timestamp' => $closeAt,
                'action_date' => $date,
                'action_time' => $closeAt->toTimeString(),
                'notes' => $reason,
            ]);
        });

        // A clock-out means the person is done — stop any tracker still running
        // so it can't keep recording un-clocked time (which would read as
        // tracked-without-clock-in). Finalize at the tracker's last real
        // activity; the desktop sees the session go inactive next heartbeat.
        TrackingSession::where('user_id', $clockIn->user_id)
            ->where('status', TrackingSession::STATUS_ACTIVE)
            ->get()
            ->each(fn (TrackingSession $session) => $this->sessions->finalize($session));

        return $clockOut;
    }

    /** The open clock-in entry for a user, or null if they're not clocked in. */
    public function openClockIn(int $userId): ?TimeEntry
    {
        $last = TimeEntry::where('user_id', $userId)
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->first();

        if (! $last || ! in_array($last->action_type, ['clock_in', 'break_start'], true)) {
            return null;
        }

        return TimeEntry::where('user_id', $userId)
            ->where('action_type', 'clock_in')
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->first();
    }
}
