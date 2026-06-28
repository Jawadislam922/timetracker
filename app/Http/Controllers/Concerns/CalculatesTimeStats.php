<?php

namespace App\Http\Controllers\Concerns;

use Carbon\Carbon;

/**
 * Derives work/break hours, last action, and current status from a chronological
 * collection of clock TimeEntry rows. Shared by the dashboard summary and the
 * attendance page so the two can't drift (PR5 — these were byte-for-byte
 * duplicated). An open clock-in/break is counted up to now, capped at 18h so a
 * forgotten clock-out doesn't inflate the figure.
 */
trait CalculatesTimeStats
{
    private function calculateTimeStats($entries)
    {
        $totalWorkMinutes = 0;
        $totalBreakMinutes = 0;
        $currentSessionStart = null;
        $currentBreakStart = null;
        $lastAction = null;
        $status = 'Not Started';

        foreach ($entries as $entry) {
            $entryTime = Carbon::parse($entry->action_timestamp)->setTimezone('Asia/Karachi');
            $lastAction = $entry->action_type;

            switch ($entry->action_type) {
                case 'clock_in':
                    $currentSessionStart = $entryTime;
                    $status = 'Working';
                    break;
                case 'clock_out':
                    if ($currentSessionStart) {
                        $totalWorkMinutes += $this->positiveMinutesBetween($currentSessionStart, $entryTime);
                        $currentSessionStart = null;
                    }
                    $status = 'Clocked Out';
                    break;
                case 'break_start':
                    $currentBreakStart = $entryTime;
                    $status = 'On Break';
                    break;
                case 'break_end':
                    if ($currentBreakStart) {
                        $totalBreakMinutes += $this->positiveMinutesBetween($currentBreakStart, $entryTime);
                        $currentBreakStart = null;
                    }
                    $status = 'Working';
                    break;
            }
        }

        $now = Carbon::now('Asia/Karachi');

        // Include a reasonable overnight session without counting stale clock-ins.
        if ($currentSessionStart) {
            $ongoingWorkMinutes = $this->positiveMinutesBetween($currentSessionStart, $now);

            if ($ongoingWorkMinutes <= 18 * 60) {
                $totalWorkMinutes += $ongoingWorkMinutes;
            }
        }

        if ($currentBreakStart) {
            $ongoingBreakMinutes = $this->positiveMinutesBetween($currentBreakStart, $now);

            if ($ongoingBreakMinutes <= 18 * 60) {
                $totalBreakMinutes += $ongoingBreakMinutes;
            }
        }

        // Calculate effective work time (excluding breaks)
        $effectiveWorkMinutes = max(0, $totalWorkMinutes - $totalBreakMinutes);

        return [
            'workHours' => round($effectiveWorkMinutes / 60, 2),
            'breakHours' => round($totalBreakMinutes / 60, 2),
            'lastAction' => $lastAction,
            'status' => $status,
        ];
    }

    private function positiveMinutesBetween(Carbon $start, Carbon $end): int
    {
        return max(0, (int) floor($start->diffInMinutes($end, false)));
    }
}
