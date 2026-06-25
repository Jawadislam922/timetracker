<?php

namespace App\Support;

use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Models\WorkHourWindow;
use Carbon\Carbon;

/**
 * Computes a user's untracked "open gaps" for one day, so manual time can only
 * be logged into time the person was actually in office but not already
 * tracking. A gap = the in-office span (clock-in→clock-out from TimeEntry)
 * MINUS breaks MINUS tracked sessions MINUS existing manual windows. Because
 * the manual-entry form forces each new window inside a gap, this structurally
 * enforces tracked + manual ≤ in-office and makes hour inflation impossible.
 *
 * All math is plain wall-clock arithmetic in app.timezone (Asia/Karachi has no
 * DST), matching how every datetime is stored. Intervals are clamped to the
 * requested calendar day so the picker (and its <input type="time"> rows) never
 * straddle midnight; the schema still permits an overnight window if ever set.
 *
 * Mirrors the clock state-machine in {@see AttendanceHours::dayInOfficeHours}.
 */
class DayGaps
{
    /** Ignore clock-ins older than this when a session is still open (matches AttendanceHours). */
    private const STALE_HOURS = 18;

    /**
     * @return array{date: string, in_office: array, busy: array, gaps: array}
     *         Each interval: {start_at, end_at (naive ISO), start, end (H:i), minutes}.
     */
    public static function compute(User $user, Carbon $date, ?int $ignoreWorkHourId = null): array
    {
        $tz = BusinessTime::tz();
        $dayStart = $date->copy()->setTimezone($tz)->startOfDay();
        $dayEnd = $dayStart->copy()->addDay();
        $now = Carbon::now($tz);

        [$inOffice, $breaks] = self::officeAndBreaks($user, $dayStart, $now);
        $tracked = self::trackedSessions($user, $dayStart, $dayEnd, $now);
        $manual = self::existingManualWindows($user, $dayStart, $dayEnd, $ignoreWorkHourId, $tz);

        $inOfficeMerged = self::merge(self::clamp($inOffice, $dayStart, $dayEnd));
        $busy = self::merge(array_merge(
            self::clamp($breaks, $dayStart, $dayEnd),
            self::clamp($tracked, $dayStart, $dayEnd),
            self::clamp($manual, $dayStart, $dayEnd),
        ));

        $gaps = [];
        foreach ($inOfficeMerged as $seg) {
            foreach (self::subtract($seg, $busy) as $g) {
                // Drop sub-minute slivers — not worth offering as a fillable gap.
                if ($g[0]->diffInSeconds($g[1]) >= 60) {
                    $gaps[] = $g;
                }
            }
        }

        return [
            'date' => $dayStart->toDateString(),
            'in_office' => self::format($inOfficeMerged),
            'busy' => self::format($busy),
            'gaps' => self::format($gaps),
        ];
    }

    /**
     * In-office segments (clock_in→clock_out, supports lunch splits) and break
     * intervals (break_start→break_end). An ongoing session/break ends at
     * min(now, start + 18h), ignoring stale open clock-ins.
     *
     * @return array{0: array<array{0: Carbon, 1: Carbon}>, 1: array<array{0: Carbon, 1: Carbon}>}
     */
    private static function officeAndBreaks(User $user, Carbon $dayStart, Carbon $now): array
    {
        $tz = $dayStart->timezone;
        $entries = TimeEntry::forUser($user->id)
            ->forDate($dayStart->toDateString())
            ->orderBy('action_timestamp')->orderBy('id')
            ->get();

        $office = [];
        $breaks = [];
        $sessionStart = null;
        $breakStart = null;

        foreach ($entries as $e) {
            $t = Carbon::parse($e->action_timestamp)->setTimezone($tz);
            switch ($e->action_type) {
                case 'clock_in':
                    $sessionStart = $t;
                    break;
                case 'clock_out':
                    if ($sessionStart) {
                        $office[] = [$sessionStart, $t];
                        $sessionStart = null;
                    }
                    break;
                case 'break_start':
                    $breakStart = $t;
                    break;
                case 'break_end':
                    if ($breakStart) {
                        $breaks[] = [$breakStart, $t];
                        $breakStart = null;
                    }
                    break;
            }
        }

        if ($sessionStart) {
            $end = self::cappedOngoingEnd($sessionStart, $now);
            if ($end->greaterThan($sessionStart)) {
                $office[] = [$sessionStart, $end];
            }
        }
        if ($breakStart) {
            $end = self::cappedOngoingEnd($breakStart, $now);
            if ($end->greaterThan($breakStart)) {
                $breaks[] = [$breakStart, $end];
            }
        }

        return [$office, $breaks];
    }

    private static function cappedOngoingEnd(Carbon $start, Carbon $now): Carbon
    {
        $cap = $start->copy()->addHours(self::STALE_HOURS);

        return $now->lessThan($cap) ? $now->copy() : $cap;
    }

    /**
     * Tracked sessions overlapping the day, clamped later. An active session
     * (no stopped_at) runs to now.
     *
     * @return array<array{0: Carbon, 1: Carbon}>
     */
    private static function trackedSessions(User $user, Carbon $dayStart, Carbon $dayEnd, Carbon $now): array
    {
        $sessions = TrackingSession::forUser($user->id)
            ->where('started_at', '<', $dayEnd)
            ->where(function ($q) use ($dayStart) {
                $q->whereNull('stopped_at')->orWhere('stopped_at', '>', $dayStart);
            })
            ->get(['started_at', 'stopped_at']);

        $out = [];
        foreach ($sessions as $s) {
            $start = $s->started_at?->copy();
            if (! $start) {
                continue;
            }
            $end = $s->stopped_at?->copy() ?? $now->copy();
            if ($end->greaterThan($start)) {
                $out[] = [$start, $end];
            }
        }

        return $out;
    }

    /**
     * Existing manual windows for the day (any non-tracker source), optionally
     * excluding the entry currently being edited.
     *
     * @return array<array{0: Carbon, 1: Carbon}>
     */
    private static function existingManualWindows(User $user, Carbon $dayStart, Carbon $dayEnd, ?int $ignoreWorkHourId, string $tz): array
    {
        $query = WorkHourWindow::query()
            ->join('work_hours', 'work_hour_windows.work_hour_id', '=', 'work_hours.id')
            ->where('work_hours.user_id', $user->id)
            ->where(function ($q) {
                $q->whereNull('work_hours.source')->orWhere('work_hours.source', '!=', 'tracker');
            })
            ->where('work_hour_windows.start_at', '<', $dayEnd)
            ->where('work_hour_windows.end_at', '>', $dayStart);

        if ($ignoreWorkHourId) {
            $query->where('work_hours.id', '!=', $ignoreWorkHourId);
        }

        $rows = $query->get(['work_hour_windows.start_at', 'work_hour_windows.end_at']);

        $out = [];
        foreach ($rows as $w) {
            $start = Carbon::parse($w->start_at)->setTimezone($tz);
            $end = Carbon::parse($w->end_at)->setTimezone($tz);
            if ($end->greaterThan($start)) {
                $out[] = [$start, $end];
            }
        }

        return $out;
    }

    /**
     * Clamp every interval to [dayStart, dayEnd], dropping empties.
     *
     * @param  array<array{0: Carbon, 1: Carbon}>  $intervals
     * @return array<array{0: Carbon, 1: Carbon}>
     */
    private static function clamp(array $intervals, Carbon $dayStart, Carbon $dayEnd): array
    {
        $out = [];
        foreach ($intervals as [$s, $e]) {
            $start = $s->greaterThan($dayStart) ? $s->copy() : $dayStart->copy();
            $end = $e->lessThan($dayEnd) ? $e->copy() : $dayEnd->copy();
            if ($end->greaterThan($start)) {
                $out[] = [$start, $end];
            }
        }

        return $out;
    }

    /**
     * Merge overlapping/adjacent intervals into a sorted, disjoint set.
     *
     * @param  array<array{0: Carbon, 1: Carbon}>  $intervals
     * @return array<array{0: Carbon, 1: Carbon}>
     */
    private static function merge(array $intervals): array
    {
        if (empty($intervals)) {
            return [];
        }

        usort($intervals, fn ($a, $b) => $a[0]->getTimestamp() <=> $b[0]->getTimestamp());

        $out = [];
        [$curStart, $curEnd] = $intervals[0];
        $curStart = $curStart->copy();
        $curEnd = $curEnd->copy();

        foreach (array_slice($intervals, 1) as [$s, $e]) {
            if ($s->lessThanOrEqualTo($curEnd)) {
                if ($e->greaterThan($curEnd)) {
                    $curEnd = $e->copy();
                }
            } else {
                $out[] = [$curStart, $curEnd];
                $curStart = $s->copy();
                $curEnd = $e->copy();
            }
        }
        $out[] = [$curStart, $curEnd];

        return $out;
    }

    /**
     * Subtract a sorted, disjoint busy set from one segment → the open gaps.
     *
     * @param  array{0: Carbon, 1: Carbon}  $segment
     * @param  array<array{0: Carbon, 1: Carbon}>  $busy
     * @return array<array{0: Carbon, 1: Carbon}>
     */
    private static function subtract(array $segment, array $busy): array
    {
        [$segStart, $segEnd] = $segment;
        $cursor = $segStart->copy();
        $gaps = [];

        foreach ($busy as [$bs, $be]) {
            if ($be->lessThanOrEqualTo($cursor)) {
                continue; // entirely before the cursor
            }
            if ($bs->greaterThanOrEqualTo($segEnd)) {
                break; // busy is sorted; nothing else can overlap
            }
            if ($bs->greaterThan($cursor)) {
                $gaps[] = [$cursor->copy(), $bs->copy()];
            }
            if ($be->greaterThan($cursor)) {
                $cursor = $be->copy();
            }
            if ($cursor->greaterThanOrEqualTo($segEnd)) {
                break;
            }
        }

        if ($cursor->lessThan($segEnd)) {
            $gaps[] = [$cursor->copy(), $segEnd->copy()];
        }

        return $gaps;
    }

    /**
     * @param  array<array{0: Carbon, 1: Carbon}>  $intervals
     */
    private static function format(array $intervals): array
    {
        $out = [];
        foreach ($intervals as [$s, $e]) {
            $out[] = [
                'start_at' => $s->format('Y-m-d\TH:i:s'),
                'end_at' => $e->format('Y-m-d\TH:i:s'),
                'start' => $s->format('H:i'),
                'end' => $e->format('H:i'),
                'minutes' => (int) round($s->diffInSeconds($e) / 60),
            ];
        }

        return $out;
    }
}
