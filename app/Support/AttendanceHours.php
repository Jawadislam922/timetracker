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
     * Did the day's first clock-in land after the user's shift start + grace?
     * Mirrors AttendanceSlackReportService::isLateClockIn.
     */
    public static function isLateClockIn(User $user, Carbon $date, ?TimeEntry $firstClockIn): bool
    {
        if (! $firstClockIn || ! $user->shift_start_time) {
            return false;
        }

        $tz = config('services.slack_reports.timezone', 'Asia/Karachi');
        $shiftStart = $date->copy()->setTimezone($tz)->setTimeFromTimeString($user->shift_start_time->format('H:i:s'));
        $allowed = $shiftStart->copy()->addMinutes((int) ($user->shift_grace_minutes ?? 0));

        return Carbon::parse($firstClockIn->action_timestamp)->setTimezone($tz)->greaterThan($allowed);
    }

    private static function positiveMinutes(Carbon $start, Carbon $end): int
    {
        return max(0, (int) floor($start->diffInMinutes($end, false)));
    }
}
