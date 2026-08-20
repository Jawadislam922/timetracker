<?php

namespace App\Services;

use App\Models\TimeEntry;
use App\Models\User;
use App\Support\AttendanceHours;
use App\Support\ShiftBand;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Builds the dashboard "Shift Board": the active tracking team grouped by shift
 * band (Day / Evening / Night / Unscheduled), each person classified into a
 * single clock state for the day so HR can read each shift at a glance instead
 * of scanning the whole roster.
 *
 * Crucially the open-session detection is GLOBAL (the worker's most-recent
 * action across days), not just today's entries — so the night team that
 * clocked in before midnight and never clocked out still reads "still clocked
 * in" at 9 AM the next day instead of vanishing into "not started" once the
 * attendance date rolls over. (Same day-boundary trap fixed for the dashboard
 * clock state.)
 */
class ShiftBoardService
{
    /** Per-status display label. */
    private const STATUS_LABELS = [
        'working' => 'Working',
        'on_break' => 'On break',
        'clocked_out' => 'Clocked out',
        'still_in' => 'Still clocked in',
        'not_in_yet' => 'Not clocked in',
        'not_started' => 'Not started',
    ];

    /** Sort order within a band after severity (most actionable first). */
    private const STATUS_ORDER = [
        'still_in' => 0,
        'not_in_yet' => 1,
        'working' => 2,
        'on_break' => 3,
        'clocked_out' => 4,
        'not_started' => 5,
    ];

    private const SEVERITY_RANK = ['red' => 0, 'amber' => 1];

    /**
     * @param  Collection<int,User>  $employees        active tracking users (shiftOverrides eager-loaded)
     * @param  Collection            $entriesByUser    user_id => chronological Collection<TimeEntry>
     * @param  Collection            $rowsById         user_id => summaryStatsFor() row (is_live, activity, tracked, current_status)
     * @param  bool                  $canManage        viewer may clock others out (attendance.edit_times)
     */
    public function build(Collection $employees, Collection $entriesByUser, Collection $rowsById, Carbon $now, bool $canManage): array
    {
        $buffer = (int) config('services.attendance.auto_close_buffer_minutes', 20);
        $defaultHours = (float) config('services.attendance.prompt_after_hours', 8);

        $rows = $employees->map(function (User $emp) use ($entriesByUser, $rowsById, $now, $canManage, $buffer, $defaultHours) {
            return $this->classify($emp, $entriesByUser->get($emp->id, collect()), $rowsById->get($emp->id, []), $now, $canManage, $buffer, $defaultHours);
        });

        // Group by the ASSIGNED shift name when the person has one, else by the
        // derived ShiftBand (Day/Evening/Night/Unscheduled). Named-shift groups
        // sort first (by the shift's sort_order), then band groups in their
        // canonical order — so once everyone has a shift the board reads as the
        // curated shifts, and un-assigned people still show during rollout.
        $grouped = $rows->groupBy(fn ($r) => $r['shift_name'] !== null ? 'shift:'.$r['shift_name'] : 'band:'.$r['band']);

        $groups = [];
        foreach ($grouped as $members) {
            $first = $members->first();
            if ($first['shift_name'] !== null) {
                $key = 'shift:'.$first['shift_name'];
                $label = $first['shift_name'];
                $range = null;
                $order = [0, $first['shift_sort'] ?? 999, $label];
            } else {
                // Band-fallback group — keep the plain band key ('day'/'evening'
                // /'night'/'unscheduled') so it stays backward-compatible.
                $band = $first['band'];
                $key = $band;
                $label = ShiftBand::label($band);
                $range = ShiftBand::rangeLabel($band);
                $bandIndex = array_search($band, ShiftBand::ORDER, true);
                $order = [1, $bandIndex === false ? 99 : $bandIndex, $label];
            }
            $groups[] = compact('key', 'label', 'range', 'members', 'order');
        }
        usort($groups, fn ($a, $b) => $a['order'] <=> $b['order']);

        $bands = [];
        foreach ($groups as $group) {
            $sorted = $group['members']->sort(function ($a, $b) {
                return [self::SEVERITY_RANK[$a['severity']] ?? 9, self::STATUS_ORDER[$a['status']] ?? 9, $a['shift_start'] ?? '99:99', $a['name']]
                    <=> [self::SEVERITY_RANK[$b['severity']] ?? 9, self::STATUS_ORDER[$b['status']] ?? 9, $b['shift_start'] ?? '99:99', $b['name']];
            })->values();

            $bands[] = [
                'key' => $group['key'],
                'label' => $group['label'],
                'range' => $group['range'],
                'summary' => [
                    'total' => $sorted->count(),
                    'on_now' => $sorted->whereIn('status', ['working', 'on_break'])->count(),
                    'still_in' => $sorted->where('status', 'still_in')->count(),
                    'not_in_yet' => $sorted->where('status', 'not_in_yet')->count(),
                    'clocked_out' => $sorted->where('status', 'clocked_out')->count(),
                    'not_started' => $sorted->where('status', 'not_started')->count(),
                ],
                'members' => $sorted->all(),
            ];
        }

        return [
            'generated_at' => $now->toISOString(),
            'bands' => $bands,
        ];
    }

    /**
     * Classify one employee into a single shift-board row.
     *
     * @param  Collection<int,TimeEntry>  $entries  this user's chronological entries (spans the loaded window)
     * @param  array                      $row      this user's summaryStatsFor() row
     */
    private function classify(User $emp, Collection $entries, array $row, Carbon $now, bool $canManage, int $buffer, float $defaultHours): array
    {
        $tz = $emp->workTimezone();
        $localNow = $now->copy()->setTimezone($tz);
        $today = $emp->attendanceDateFor($now);

        // Band + displayed start use TODAY's EFFECTIVE shift (honouring a one-day
        // override), not the standing column — so an override that moves someone
        // to a different shift for the day files them under the right band and
        // shows the start time the rest of the row (suggested clock-out) uses.
        $effectiveStart = $emp->effectiveShiftFor($today)['start_time'] ?? $emp->shift_start_time;

        $todayEntries = $entries->filter(fn ($e) => $e->action_date->toDateString() === $today)->values();
        $firstClockInToday = $todayEntries->firstWhere('action_type', 'clock_in');
        $lastClockOutToday = $todayEntries->where('action_type', 'clock_out')->last();

        // GLOBAL latest action (entries are chronological asc) — drives the
        // carry-over-aware open-session check.
        $globalLast = $entries->last();
        $openType = $globalLast && in_array($globalLast->action_type, ['clock_in', 'break_start', 'break_end'], true)
            ? $globalLast->action_type
            : null;

        $isLive = (bool) ($row['is_live'] ?? false);
        $activity = (int) ($row['activity_percent'] ?? 0);
        $tracked = (float) ($row['tracked_hours'] ?? 0);

        $status = 'not_started';
        $severity = null;
        $exception = null;
        $openSince = null;
        $suggestedClockOut = null;
        $canClockOut = false;

        if ($openType !== null) {
            // The session's anchoring clock-in (most recent clock_in row).
            $openClockIn = $entries->where('action_type', 'clock_in')->last();
            $openTs = $openClockIn
                ? Carbon::parse($openClockIn->action_timestamp)->setTimezone($tz)
                : $localNow->copy();
            $openSince = $openTs;
            $openDate = $openClockIn
                ? ($openClockIn->action_date instanceof Carbon ? $openClockIn->action_date->toDateString() : (string) $openClockIn->action_date)
                : $today;

            $shiftEnd = $this->shiftEndFor($emp, $openDate, $openTs, $defaultHours);
            $suggestedClockOut = $shiftEnd->format('H:i');
            $canClockOut = $canManage;
            $closeAt = $shiftEnd->copy()->addMinutes($buffer);
            $pastShiftEnd = $localNow->greaterThan($closeAt);

            if ($pastShiftEnd && ! $isLive) {
                // The headline case: forgot to clock out (works across midnight).
                $status = 'still_in';
                $severity = 'red';
                $exception = 'Still clocked in since '.$openTs->format('g:i A').' — likely forgot to clock out';
            } elseif ($openType === 'break_start') {
                $status = 'on_break';
                $breakMins = (int) Carbon::parse($globalLast->action_timestamp)->setTimezone($tz)->diffInMinutes($localNow);
                if ($breakMins > 90) {
                    $severity = 'amber';
                    $exception = 'On break '.$breakMins.'m';
                }
            } else {
                $status = 'working';
                if (AttendanceHours::isLateClockIn($emp, $now, $firstClockInToday)) {
                    $severity = 'amber';
                    $exception = 'Late clock-in';
                } elseif ($isLive && ! $firstClockInToday) {
                    $severity = 'amber';
                    $exception = 'Tracking without clocking in';
                } elseif (! $isLive && $tracked < 0.1) {
                    $severity = 'amber';
                    $exception = 'Clocked in but not tracking';
                } elseif ($tracked > 0 && $activity < 30) {
                    $severity = 'amber';
                    $exception = 'Low activity ('.$activity.'%)';
                }
            }
        } elseif ($todayEntries->isNotEmpty()) {
            // Worked and clocked out today.
            $status = 'clocked_out';
        } elseif ($this->shiftStarted($emp, $now, $today)) {
            // Their shift start (+ grace) has passed and there's no clock-in.
            $status = 'not_in_yet';
            $severity = 'amber';
            $exception = 'Not clocked in yet';
        }

        $firstIn = null;
        if ($firstClockInToday) {
            $firstIn = Carbon::parse($firstClockInToday->action_timestamp)->setTimezone($tz)->format('g:i A');
        } elseif ($openSince) {
            // Carried over from an earlier day — show the date so it reads right.
            $firstIn = $openSince->format('M j, g:i A');
        }
        $lastOut = $lastClockOutToday
            ? Carbon::parse($lastClockOutToday->action_timestamp)->setTimezone($tz)->format('g:i A')
            : null;

        return [
            'user_id' => $emp->id,
            'name' => $emp->name,
            'avatar' => $emp->avatar_url ?? null,
            'designation' => $emp->designation ?? 'Employee',
            'shift_name' => $emp->shift?->name,
            'shift_sort' => $emp->shift?->sort_order,
            'shift_start' => $effectiveStart?->format('H:i'),
            'band' => ShiftBand::classify($effectiveStart),
            'status' => $status,
            'status_label' => self::STATUS_LABELS[$status] ?? ucfirst($status),
            'severity' => $severity,
            'exception' => $exception,
            'first_in' => $firstIn,
            'last_out' => $lastOut,
            'is_live' => $isLive,
            'activity_percent' => $activity,
            'tracked_hours' => round($tracked, 2),
            'can_clock_out' => $canClockOut,
            'suggested_clock_out' => $suggestedClockOut,
        ];
    }

    /**
     * Shift end instant (worker tz) for an open session that started on $date —
     * the same shift-end + buffer the auto-close and "forgot to clock out"
     * checks use, so the board, the nudge and the suggested clock-out time all
     * agree. Falls back to clock-in + default hours when no shift is set.
     */
    private function shiftEndFor(User $emp, string $date, Carbon $openTs, float $defaultHours): Carbon
    {
        $tz = $emp->workTimezone();
        $shift = $emp->effectiveShiftFor($date);
        $shiftHours = $shift['hours'] ?? $defaultHours;

        $end = $shift['start_time']
            ? Carbon::parse($date.' '.$shift['start_time']->format('H:i:s'), $tz)->addMinutes((int) round($shiftHours * 60))
            : $openTs->copy()->addMinutes((int) round($shiftHours * 60));

        // Never suggest a clock-out at or before the clock-in (e.g. a shift whose
        // computed end predates a late clock-in).
        if ($end->lessThanOrEqualTo($openTs)) {
            $end = $openTs->copy()->addMinutes((int) round($shiftHours * 60));
        }

        return $end;
    }

    /** True when the worker's shift start (+ grace) has passed today and they have no clock-in. */
    private function shiftStarted(User $emp, Carbon $now, string $today): bool
    {
        $shift = $emp->effectiveShiftFor($today);
        if (! $shift['start_time']) {
            return false;
        }

        // Grace comes from the resolver, not the model column — a raw read here
        // would judge the day against whatever grace HR has set right now.
        $tz = $emp->workTimezone();
        $dueAt = Carbon::parse($today.' '.$shift['start_time']->format('H:i:s'), $tz)
            ->addMinutes($shift['grace_minutes']);

        return $now->copy()->setTimezone($tz)->greaterThan($dueAt);
    }
}
