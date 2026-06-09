<?php

namespace App\Http\Controllers;

use App\Models\ManualAttendanceMark;
use App\Models\TimeEntry;
use App\Models\User;
use App\Services\AttendanceSlackReportService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use RuntimeException;

class EmployeeAttendanceController extends Controller
{
    private const ATTENDANCE_STATUSES = [
        'P' => 'Present',
        'A' => 'Absent',
        'H' => 'Holiday',
        'L' => 'Leave',
        'HD' => 'Half day',
        'WFH' => 'Work from home',
        'LI' => 'Late joining',
        'PH' => 'Public holiday',
    ];

    /**
     * Display the employee attendance page
     */
    public function index()
    {
        return Inertia::render('EmployeeAttendance', [
            'serverDate' => Carbon::today('Asia/Karachi')->toDateString(),
            'canManuallyMarkAttendance' => $this->canManuallyMarkAttendance(request()->user()),
            'canSendAttendanceSlack' => request()->user()?->hasPermission('reports.send_slack') ?? false,
            'slackConfigured' => app(AttendanceSlackReportService::class)->configured(),
        ]);
    }

    public function getMonthlyGrid(Request $request)
    {
        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);

        $month = $validated['month'] ?? Carbon::today('Asia/Karachi')->format('Y-m');
        $startDate = Carbon::createFromFormat('Y-m-d', "{$month}-01", 'Asia/Karachi')->startOfDay();
        $endDate = $startDate->copy()->endOfMonth();
        $now = Carbon::now('Asia/Karachi');
        $today = $now->copy()->startOfDay();

        $days = collect(range(1, $endDate->day))->map(function (int $day) use ($startDate) {
            $date = $startDate->copy()->day($day);

            return [
                'date' => $date->toDateString(),
                'day' => $date->day,
                'weekday' => $date->format('D'),
                'is_weekend' => $date->isSunday(),
            ];
        });

        $entriesByUserDate = TimeEntry::query()
            ->whereBetween('action_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->orderBy('action_timestamp')
            ->get()
            ->groupBy(fn (TimeEntry $entry) => $entry->user_id.'|'.$entry->action_date->toDateString());

        $manualMarks = ManualAttendanceMark::query()
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get()
            ->keyBy(fn (ManualAttendanceMark $mark) => $mark->user_id.'|'.$mark->attendance_date->toDateString());

        $summaryTemplate = [
            'holidays' => 0,
            'present' => 0,
            'absent' => 0,
            'leave' => 0,
            'half_day' => 0,
            'work_from_home' => 0,
            'late_joining' => 0,
            'public_holiday' => 0,
            'total_work_hours' => 0,
        ];

        $employees = User::query()
            ->orderBy('name')
            ->get()
            ->map(function (User $employee) use ($days, $entriesByUserDate, $manualMarks, $now, $today, $summaryTemplate) {
                $summary = $summaryTemplate;

                $dayCells = $days->map(function (array $day) use ($employee, $entriesByUserDate, $manualMarks, $now, $today, &$summary) {
                    $date = Carbon::parse($day['date'], 'Asia/Karachi');
                    $key = $employee->id.'|'.$day['date'];
                    $entries = $entriesByUserDate->get($key, collect());
                    $manualMark = $manualMarks->get($key);
                    $stats = $entries->isNotEmpty() ? $this->calculateTimeStats($entries) : null;

                    $firstClockIn = $entries->where('action_type', 'clock_in')->first();
                    $lastEntry = $entries->last();
                    $status = $this->resolveMonthlyStatus($employee, $date, $entries, $manualMark, $now, $today, $firstClockIn);
                    $this->addStatusToSummary($summary, $status['code'], $stats['workHours'] ?? 0);

                    return [
                        'date' => $day['date'],
                        'status_code' => $status['code'],
                        'status_label' => $status['label'],
                        'source' => $status['source'],
                        'work_hours' => $stats['workHours'] ?? 0,
                        'break_hours' => $stats['breakHours'] ?? 0,
                        'first_clock_in' => $firstClockIn ? $firstClockIn->formatted_action_time : null,
                        'last_action_time' => $lastEntry ? $lastEntry->formatted_action_time : null,
                        'manual_note' => $manualMark?->note,
                    ];
                })->values();

                $summary['total_work_hours'] = round($summary['total_work_hours'], 2);

                return [
                    'user_id' => $employee->id,
                    'user_name' => $employee->name,
                    'avatar' => $employee->avatar_url ?? null,
                    'designation' => $employee->designation ?? 'Employee',
                    'days' => $dayCells,
                    'summary' => $summary,
                ];
            })
            ->values();

        return response()->json([
            'month' => $month,
            'days' => $days->values(),
            'employees' => $employees,
            'statusOptions' => collect(self::ATTENDANCE_STATUSES)
                ->map(fn (string $label, string $code) => ['code' => $code, 'label' => $label])
                ->values(),
            'canManualMark' => $this->canManuallyMarkAttendance($request->user()),
        ]);
    }

    public function updateManualStatus(Request $request)
    {
        if (! $this->canManuallyMarkAttendance($request->user())) {
            abort(403, 'You do not have permission to manually mark attendance.');
        }

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'status_code' => ['nullable', Rule::in(array_keys(self::ATTENDANCE_STATUSES))],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $date = Carbon::parse($validated['date'], 'Asia/Karachi')->toDateString();
        $statusCode = $validated['status_code'] ?? null;

        if (! $statusCode) {
            ManualAttendanceMark::query()
                ->where('user_id', $validated['user_id'])
                ->whereDate('attendance_date', $date)
                ->delete();

            return response()->json(['message' => 'Manual attendance mark cleared.']);
        }

        ManualAttendanceMark::updateOrCreate(
            [
                'user_id' => $validated['user_id'],
                'attendance_date' => $date,
            ],
            [
                'marked_by_user_id' => $request->user()->id,
                'status_code' => $statusCode,
                'note' => $validated['note'] ?? null,
            ]
        );

        return response()->json(['message' => 'Attendance status updated.']);
    }

    public function updateCalendar(Request $request)
    {
        if (! $this->canManuallyMarkAttendance($request->user())) {
            abort(403, 'You do not have permission to schedule attendance.');
        }

        $validated = $request->validate([
            'operation' => ['required', Rule::in(['apply', 'clear'])],
            'scope' => ['required', Rule::in(['company', 'selected'])],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'start_date' => ['required', 'date_format:Y-m-d'],
            'end_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'status_code' => ['nullable', Rule::in(['H', 'PH', 'L', 'HD', 'WFH'])],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if ($validated['operation'] === 'apply' && empty($validated['status_code'])) {
            throw ValidationException::withMessages([
                'status_code' => 'Choose an attendance status to apply.',
            ]);
        }

        $startDate = Carbon::parse($validated['start_date'], 'Asia/Karachi')->startOfDay();
        $endDate = Carbon::parse($validated['end_date'], 'Asia/Karachi')->startOfDay();

        if ($startDate->diffInDays($endDate) > 365) {
            throw ValidationException::withMessages([
                'end_date' => 'The attendance calendar range cannot exceed 366 days.',
            ]);
        }

        $userIds = $validated['scope'] === 'company'
            ? User::query()->pluck('id')->all()
            : array_values(array_unique($validated['user_ids'] ?? []));

        if ($userIds === []) {
            throw ValidationException::withMessages([
                'user_ids' => 'Select at least one user.',
            ]);
        }

        $dates = collect(CarbonPeriod::create($startDate, $endDate))
            ->map(fn (Carbon $date) => $date->toDateString());

        $affected = DB::transaction(function () use ($validated, $userIds, $dates, $request) {
            if ($validated['operation'] === 'clear') {
                return ManualAttendanceMark::query()
                    ->whereIn('user_id', $userIds)
                    ->whereDate('attendance_date', '>=', $dates->first())
                    ->whereDate('attendance_date', '<=', $dates->last())
                    ->delete();
            }

            $affected = 0;

            foreach ($userIds as $userId) {
                foreach ($dates as $date) {
                    $mark = ManualAttendanceMark::query()
                        ->where('user_id', $userId)
                        ->whereDate('attendance_date', $date)
                        ->first() ?? new ManualAttendanceMark([
                            'user_id' => $userId,
                            'attendance_date' => $date,
                        ]);

                    $mark->fill([
                        'marked_by_user_id' => $request->user()->id,
                        'status_code' => $validated['status_code'],
                        'note' => $validated['note'] ?? null,
                    ])->save();
                    $affected++;
                }
            }

            return $affected;
        });

        return response()->json([
            'message' => $validated['operation'] === 'clear'
                ? "Removed {$affected} scheduled attendance marks."
                : "Applied attendance to {$affected} person-days.",
            'affected' => $affected,
        ]);
    }

    public function sendSlack(Request $request, AttendanceSlackReportService $slack)
    {
        $validated = $request->validate([
            'month' => ['required', 'date_format:Y-m'],
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer', 'exists:users,id'],
            'include_fields' => ['required', 'array', 'min:1'],
            'include_fields.*' => [
                'string',
                Rule::in([
                    'present',
                    'absent',
                    'leave',
                    'half_day',
                    'work_from_home',
                    'late_joining',
                    'holidays',
                    'public_holiday',
                    'total_work_hours',
                ]),
            ],
        ]);

        try {
            $summary = $slack->sendMonthly(
                $validated['month'],
                $validated['user_ids'],
                $validated['include_fields']
            );
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'slack' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'message' => "Attendance report sent to Slack for {$summary['month']}.",
        ]);
    }

    /**
     * Get summary view data
     */
    public function getSummary(Request $request)
    {
        $date = Carbon::parse($request->input('date', Carbon::today('Asia/Karachi')->toDateString()), 'Asia/Karachi')->toDateString();

        $employees = User::all()->map(function ($employee) use ($date) {
            $entries = $employee->timeEntries()
                ->whereDate('action_date', $date)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            if ($entries->isEmpty()) {
                return null;
            }

            $stats = $this->calculateTimeStats($entries);

            // Get first clock in time
            $firstClockIn = $entries->where('action_type', 'clock_in')->first();

            // Get last action
            $lastEntry = $entries->last();

            return [
                'user_id' => $employee->id,
                'user_name' => $employee->name,
                'avatar' => $employee->avatar_url ?? null,
                'designation' => $employee->designation ?? 'Employee',
                'total_work_hours' => $stats['workHours'],
                'total_break_hours' => $stats['breakHours'],
                'current_status' => $stats['status'],
                'first_clock_in' => $firstClockIn ? $firstClockIn->formatted_action_time : null,
                'last_action_time' => $lastEntry ? $lastEntry->formatted_action_time : null,
                'total_entries' => $entries->count(),
            ];
        })->filter()->values();

        return response()->json([
            'employees' => $employees,
        ]);
    }

    /**
     * Get detailed activity view data
     */
    public function getDetailed(Request $request)
    {
        $date = Carbon::parse($request->input('date', Carbon::today('Asia/Karachi')->toDateString()), 'Asia/Karachi')->toDateString();

        $activities = User::all()->map(function ($employee) use ($date) {
            $entries = $employee->timeEntries()
                ->whereDate('action_date', $date)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            if ($entries->isEmpty()) {
                return null;
            }

            return [
                'user_id' => $employee->id,
                'user_name' => $employee->name,
                'avatar' => $employee->avatar_url ?? null,
                'designation' => $employee->designation ?? 'Employee',
                'entries' => $entries->map(function ($entry) {
                    return [
                        'id' => $entry->id,
                        'action_type' => $entry->action_type,
                        'formatted_time' => $entry->formatted_action_time,
                        'notes' => $entry->notes,
                    ];
                }),
            ];
        })->filter()->values();

        return response()->json([
            'activities' => $activities,
        ]);
    }

    /**
     * Get timeline view data
     */
    public function getTimeline(Request $request)
    {
        $date = Carbon::parse($request->input('date', Carbon::today('Asia/Karachi')->toDateString()), 'Asia/Karachi')->toDateString();

        $timelines = User::all()->map(function ($employee) use ($date) {
            $entries = $employee->timeEntries()
                ->whereDate('action_date', $date)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            if ($entries->isEmpty()) {
                return null;
            }

            $stats = $this->calculateTimeStats($entries);
            $sessions = $this->buildSessions($entries);

            return [
                'user_id' => $employee->id,
                'user_name' => $employee->name,
                'avatar' => $employee->avatar_url ?? null,
                'designation' => $employee->designation ?? 'Employee',
                'total_work_hours' => $stats['workHours'],
                'total_break_hours' => $stats['breakHours'],
                'sessions' => $sessions,
            ];
        })->filter()->values();

        return response()->json([
            'timelines' => $timelines,
        ]);
    }

    /**
     * Export attendance data as CSV
     */
    public function export(Request $request)
    {
        $date = Carbon::parse($request->input('date', Carbon::today('Asia/Karachi')->toDateString()), 'Asia/Karachi')->toDateString();

        $csv = "Employee,Designation,Status,Work Hours,Break Hours,First Clock In,Last Action,Total Actions\n";

        $employees = User::all();

        foreach ($employees as $employee) {
            $entries = $employee->timeEntries()
                ->whereDate('action_date', $date)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            if ($entries->isEmpty()) {
                continue;
            }

            $stats = $this->calculateTimeStats($entries);
            $firstClockIn = $entries->where('action_type', 'clock_in')->first();
            $lastEntry = $entries->last();

            $csv .= implode(',', [
                '"'.$employee->name.'"',
                '"'.($employee->designation ?? 'Employee').'"',
                '"'.$stats['status'].'"',
                number_format($stats['workHours'], 2),
                number_format($stats['breakHours'], 2),
                '"'.($firstClockIn ? $firstClockIn->formatted_action_time : '-').'"',
                '"'.($lastEntry ? $lastEntry->formatted_action_time : '-').'"',
                $entries->count(),
            ])."\n";

            // Add detailed entries
            $csv .= "\nDetailed Activity:\n";
            $csv .= "Time,Action,Notes\n";
            foreach ($entries as $entry) {
                $csv .= implode(',', [
                    '"'.$entry->formatted_action_time.'"',
                    '"'.str_replace('_', ' ', ucwords($entry->action_type)).'"',
                    '"'.($entry->notes ?? '').'"',
                ])."\n";
            }
            $csv .= "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="employee-attendance-'.$date.'.csv"');
    }

    /**
     * Calculate time statistics from entries
     */
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

    /**
     * Build work and break sessions from entries
     */
    private function buildSessions($entries)
    {
        $sessions = [];
        $currentWorkStart = null;
        $currentBreakStart = null;

        foreach ($entries as $entry) {
            $entryTime = Carbon::parse($entry->action_timestamp)->setTimezone('Asia/Karachi');

            switch ($entry->action_type) {
                case 'clock_in':
                    $currentWorkStart = $entryTime;
                    break;

                case 'clock_out':
                    if ($currentWorkStart) {
                        $durationMinutes = $this->positiveMinutesBetween($currentWorkStart, $entryTime);
                        $sessions[] = [
                            'type' => 'work',
                            'start_time' => $currentWorkStart->format('g:i A'),
                            'end_time' => $entryTime->format('g:i A'),
                            'duration' => $this->formatDuration($durationMinutes),
                        ];
                        $currentWorkStart = null;
                    }
                    break;

                case 'break_start':
                    $currentBreakStart = $entryTime;
                    break;

                case 'break_end':
                    if ($currentBreakStart) {
                        $durationMinutes = $this->positiveMinutesBetween($currentBreakStart, $entryTime);
                        $sessions[] = [
                            'type' => 'break',
                            'start_time' => $currentBreakStart->format('g:i A'),
                            'end_time' => $entryTime->format('g:i A'),
                            'duration' => $this->formatDuration($durationMinutes),
                        ];
                        $currentBreakStart = null;
                    }
                    break;
            }
        }

        $now = Carbon::now('Asia/Karachi');

        // Add ongoing session if it belongs to today.
        if ($currentWorkStart && $currentWorkStart->isSameDay($now)) {
            $durationMinutes = $this->positiveMinutesBetween($currentWorkStart, $now);
            $sessions[] = [
                'type' => 'work',
                'start_time' => $currentWorkStart->format('g:i A'),
                'end_time' => null,
                'duration' => $this->formatDuration($durationMinutes).' (ongoing)',
            ];
        }

        if ($currentBreakStart && $currentBreakStart->isSameDay($now)) {
            $durationMinutes = $this->positiveMinutesBetween($currentBreakStart, $now);
            $sessions[] = [
                'type' => 'break',
                'start_time' => $currentBreakStart->format('g:i A'),
                'end_time' => null,
                'duration' => $this->formatDuration($durationMinutes).' (ongoing)',
            ];
        }

        return $sessions;
    }

    /**
     * Format duration in human readable format
     */
    private function positiveMinutesBetween(Carbon $start, Carbon $end): int
    {
        return max(0, (int) floor($start->diffInMinutes($end, false)));
    }

    private function resolveMonthlyStatus(
        User $employee,
        Carbon $date,
        $entries,
        ?ManualAttendanceMark $manualMark,
        Carbon $now,
        Carbon $today,
        ?TimeEntry $firstClockIn
    ): array {
        if ($manualMark) {
            return [
                'code' => $manualMark->status_code,
                'label' => self::ATTENDANCE_STATUSES[$manualMark->status_code] ?? $manualMark->status_code,
                'source' => 'manual',
            ];
        }

        if ($date->isFuture() && ! $date->isSameDay($today)) {
            return [
                'code' => null,
                'label' => 'Not set',
                'source' => 'future',
            ];
        }

        if ($firstClockIn) {
            if ($this->isLateClockIn($employee, $date, $firstClockIn)) {
                return [
                    'code' => 'LI',
                    'label' => self::ATTENDANCE_STATUSES['LI'],
                    'source' => 'automatic',
                ];
            }

            return [
                'code' => 'P',
                'label' => self::ATTENDANCE_STATUSES['P'],
                'source' => 'automatic',
            ];
        }

        if ($date->isSunday()) {
            return [
                'code' => 'H',
                'label' => self::ATTENDANCE_STATUSES['H'],
                'source' => 'automatic',
            ];
        }

        if ($date->isSameDay($today) && ! $this->isShiftAbsenceDue($employee, $date, $now)) {
            return [
                'code' => null,
                'label' => 'Shift not started',
                'source' => 'pending',
            ];
        }

        return [
            'code' => 'A',
            'label' => self::ATTENDANCE_STATUSES['A'],
            'source' => 'automatic',
        ];
    }

    private function addStatusToSummary(array &$summary, ?string $statusCode, float|int $workHours): void
    {
        $summary['total_work_hours'] += (float) $workHours;

        if ($statusCode === 'LI') {
            $summary['present']++;
            $summary['late_joining']++;

            return;
        }

        match ($statusCode) {
            'P' => $summary['present']++,
            'A' => $summary['absent']++,
            'H' => $summary['holidays']++,
            'L' => $summary['leave']++,
            'HD' => $summary['half_day']++,
            'WFH' => $summary['work_from_home']++,
            'PH' => $summary['public_holiday']++,
            default => null,
        };
    }

    private function isLateClockIn(User $employee, Carbon $date, TimeEntry $firstClockIn): bool
    {
        if (! $employee->shift_start_time) {
            return false;
        }

        $shiftStart = $date->copy()->setTimeFromTimeString($employee->shift_start_time->format('H:i:s'));
        $allowedClockIn = $shiftStart->copy()->addMinutes((int) ($employee->shift_grace_minutes ?? 0));
        $clockInTime = Carbon::parse($firstClockIn->action_timestamp)->setTimezone('Asia/Karachi');

        return $clockInTime->greaterThan($allowedClockIn);
    }

    private function isShiftAbsenceDue(User $employee, Carbon $date, Carbon $now): bool
    {
        if (! $employee->shift_start_time) {
            return false;
        }

        $absenceDueAt = $date->copy()
            ->setTimeFromTimeString($employee->shift_start_time->format('H:i:s'))
            ->addMinutes((int) ($employee->shift_grace_minutes ?? 0));

        return $now->greaterThan($absenceDueAt);
    }

    private function canManuallyMarkAttendance(?User $user): bool
    {
        return (bool) $user && (
            $user->isSuperAdmin()
            || $user->hasPermission('attendance.manual_mark')
        );
    }

    private function formatDuration(int $durationMinutes)
    {
        $hours = intdiv($durationMinutes, 60);
        $minutes = $durationMinutes % 60;

        if ($hours > 0) {
            return "{$hours}h {$minutes}m";
        }

        return "{$minutes}m";
    }
}
