<?php

namespace App\Support;

use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;

/**
 * Shared attendance calculations used by the weekly Slack digest, mirroring the
 * logic the attendance pages already use so the numbers never disagree:
 *  - in-office hours for a day's time-clock entries (clock-in→out minus breaks)
 *  - whether the first clock-in counts as "late" (after shift start + grace)
 */
class AttendanceHours
{
    /**
     * Effective in-office hours for one day's TimeEntry rows (work minus break),
     * matching EmployeeAttendanceController::calculateTimeStats.
     *
     * @param  iterable<TimeEntry>  $entries  one user's entries for one day, chronological
     */
    public static function dayInOfficeHours(iterable $entries): float
    {
        $tz = 'Asia/Karachi';
        $workMin = 0;
        $breakMin = 0;
        $sessionStart = null;
        $breakStart = null;

        foreach ($entries as $entry) {
            $t = Carbon::parse($entry->action_timestamp)->setTimezone($tz);
            switch ($entry->action_type) {
                case 'clock_in': $sessionStart = $t; break;
                case 'clock_out':
                    if ($sessionStart) { $workMin += self::positiveMinutes($sessionStart, $t); $sessionStart = null; }
                    break;
                case 'break_start': $breakStart = $t; break;
                case 'break_end':
                    if ($breakStart) { $breakMin += self::positiveMinutes($breakStart, $t); $breakStart = null; }
                    break;
            }
        }

        $now = Carbon::now($tz);
        // Count an ongoing session/break, ignoring stale clock-ins (>18h).
        if ($sessionStart) {
            $m = self::positiveMinutes($sessionStart, $now);
            if ($m <= 18 * 60) { $workMin += $m; }
        }
        if ($breakStart) {
            $m = self::positiveMinutes($breakStart, $now);
            if ($m <= 18 * 60) { $breakMin += $m; }
        }

        return round(max(0, $workMin - $breakMin) / 60, 2);
    }

    /**
     * In-office SECONDS that fall inside a calendar window [start, end] — the
     * present time (clock-in→out) minus breaks, clipped to the window. Unlike
     * {@see dayInOfficeHours} (which pairs a single pre-grouped day), this takes
     * the user's FULL ordered entry stream and splits an overnight span at the
     * window boundary, so in-office buckets by CALENDAR day exactly like
     * TrackingSessionService::inDaySeconds does for tracked time. That lets the
     * per-person analytics chart the two series on the same day axis (they were
     * previously in-office-by-shift-day vs tracked-by-calendar-day, which read
     * as "tracked > in-office" nonsense for night workers).
     *
     * @param  iterable<TimeEntry>  $entries  one user's entries, chronological
     */
    public static function inOfficeSecondsInWindow(iterable $entries, Carbon $windowStart, Carbon $windowEnd): int
    {
        $tz = 'Asia/Karachi';
        $now = Carbon::now($tz);

        // Reconstruct present- and break-intervals from the full stream.
        $present = [];
        $breaks = [];
        $sessionStart = null;
        $breakStart = null;

        foreach ($entries as $entry) {
            $t = Carbon::parse($entry->action_timestamp)->setTimezone($tz);
            switch ($entry->action_type) {
                case 'clock_in': $sessionStart = $t; break;
                case 'clock_out':
                    if ($sessionStart) { $present[] = [$sessionStart, $t]; $sessionStart = null; }
                    break;
                case 'break_start': $breakStart = $t; break;
                case 'break_end':
                    if ($breakStart) { $breaks[] = [$breakStart, $t]; $breakStart = null; }
                    break;
            }
        }
        // An ongoing clock-in/break counts up to now, ignoring stale (>18h) ones.
        if ($sessionStart && self::positiveMinutes($sessionStart, $now) <= 18 * 60) { $present[] = [$sessionStart, $now]; }
        if ($breakStart && self::positiveMinutes($breakStart, $now) <= 18 * 60) { $breaks[] = [$breakStart, $now]; }

        $overlap = static function (array $intervals) use ($windowStart, $windowEnd): int {
            $sec = 0;
            foreach ($intervals as [$s, $e]) {
                $os = $s->greaterThan($windowStart) ? $s : $windowStart;
                $oe = $e->lessThan($windowEnd) ? $e : $windowEnd;
                $sec += max(0, $oe->getTimestamp() - $os->getTimestamp());
            }

            return $sec;
        };

        return max(0, $overlap($present) - $overlap($breaks));
    }

    /**
     * Did the day's first clock-in land after the user's shift start + grace?
     * Mirrors AttendanceSlackReportService::isLateClockIn.
     */
    public static function isLateClockIn(User $user, Carbon $date, ?TimeEntry $firstClockIn): bool
    {
        if (! $firstClockIn) {
            return false;
        }

        // Late detection compares the clock-in's wall-clock time-of-day to the
        // shift start, so it must use the WORKER's own timezone (a 9am shift for
        // a New York VA means 9am New York, not 9am Karachi).
        $tz = $user->workTimezone();
        $localDate = $date->copy()->setTimezone($tz);

        // Resolve the shift start for THIS day (one-day override aware), so an
        // approved early/late start isn't flagged late.
        $shiftStartTime = $user->effectiveShiftFor($localDate->toDateString())['start_time'];
        if (! $shiftStartTime) {
            return false;
        }

        $shiftStart = $localDate->copy()->setTimeFromTimeString($shiftStartTime->format('H:i:s'));
        $allowed = $shiftStart->copy()->addMinutes((int) ($user->shift_grace_minutes ?? 0));

        return Carbon::parse($firstClockIn->action_timestamp)->setTimezone($tz)->greaterThan($allowed);
    }

    private static function positiveMinutes(Carbon $start, Carbon $end): int
    {
        return max(0, (int) floor($start->diffInMinutes($end, false)));
    }
}
