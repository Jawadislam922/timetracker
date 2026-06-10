<?php

namespace App\Http\Controllers;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TimeEntryController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();
        $query = TimeEntry::forUser($user->id)->with('user');

        // Filter by date if provided
        if ($request->has('date')) {
            $query->forDate($request->date);
        }

        $entries = $query->recent(100)->get();

        return response()->json([
            'entries' => $entries->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'action_type' => $entry->action_type,
                    'action_timestamp' => $entry->action_timestamp->toISOString(),
                    'formatted_date' => $entry->formatted_action_date,
                    'formatted_time' => $entry->formatted_action_time,
                    'notes' => $entry->notes,
                    'user_name' => $entry->user->name,
                ];
            }),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'action_type' => 'required|in:clock_in,clock_out,break_start,break_end',
            'notes' => 'nullable|string|max:255',
        ]);

        $now = Carbon::now('Asia/Karachi');
        $user = Auth::user();
        $actionType = $validated['action_type'];
        $attendanceDate = $user->attendanceDateFor($now);
        $lastAction = TimeEntry::forUser($user->id)
            ->forDate($attendanceDate)
            ->orderBy('action_timestamp', 'desc')
            ->value('action_type');

        if (! $this->isActionAllowed($lastAction, $actionType)) {
            return response()->json([
                'message' => $this->blockedActionMessage($lastAction, $actionType),
            ], 422);
        }

        $entry = TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => $actionType,
            'action_timestamp' => $now,
            'action_date' => $attendanceDate,
            'action_time' => $now->toTimeString(),
            'notes' => $validated['notes'] ?? null,
        ]);

        return response()->json([
            'entry' => [
                'id' => $entry->id,
                'action_type' => $entry->action_type,
                'action_timestamp' => $entry->action_timestamp->toISOString(),
                'formatted_date' => $entry->formatted_action_date,
                'formatted_time' => $entry->formatted_action_time,
                'notes' => $entry->notes,
                'user_name' => $user->name,
            ],
            'message' => 'Time entry recorded successfully',
        ]);
    }

    private function isActionAllowed(?string $lastAction, string $nextAction): bool
    {
        if ($lastAction === null) {
            return $nextAction === 'clock_in';
        }

        return match ($lastAction) {
            'clock_in' => in_array($nextAction, ['clock_out', 'break_start'], true),
            'break_start' => $nextAction === 'break_end',
            'break_end' => in_array($nextAction, ['clock_out', 'break_start'], true),
            'clock_out' => $nextAction === 'clock_in',
            default => false,
        };
    }

    private function blockedActionMessage(?string $lastAction, string $nextAction): string
    {
        if ($lastAction === null) {
            return 'Please clock in before recording another action.';
        }

        if ($lastAction === 'break_start' && $nextAction === 'clock_out') {
            return 'Please end your break before clocking out.';
        }

        return 'This time action is not available from your current status.';
    }

    public function export(Request $request)
    {
        $user = Auth::user();
        $query = TimeEntry::forUser($user->id)->with('user');

        // Filter by date range if provided
        if ($request->has('start_date')) {
            $query->whereDate('action_date', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('action_date', '<=', $request->end_date);
        }

        $entries = $query->orderBy('action_timestamp', 'desc')->get();

        $csv = "Date,Time,Employee,Action,Notes\n";
        foreach ($entries as $entry) {
            $csv .= implode(',', [
                $entry->formatted_action_date,
                $entry->formatted_action_time,
                $entry->user->name,
                str_replace('_', ' ', ucwords($entry->action_type)),
                '"'.($entry->notes ?? '').'"',
            ])."\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="time-entries-'.now()->format('Y-m-d').'.csv"');
    }

    public function getTodaysEntries()
    {
        $user = Auth::user();
        $today = $user->attendanceDateFor(Carbon::now('Asia/Karachi'));

        $entries = TimeEntry::forUser($user->id)
            ->forDate($today)
            ->orderBy('action_timestamp', 'desc')
            ->get();

        return response()->json([
            'entries' => $entries->map(function ($entry) {
                return [
                    'id' => $entry->id,
                    'action_type' => $entry->action_type,
                    'action_timestamp' => $entry->action_timestamp->toISOString(),
                    'formatted_date' => $entry->formatted_action_date,
                    'formatted_time' => $entry->formatted_action_time,
                    'notes' => $entry->notes,
                    'user_name' => $entry->user->name,
                ];
            }),
        ]);
    }

    public function getTodaysSummary()
    {
        $user = Auth::user();
        $now = Carbon::now('Asia/Karachi');
        $weekStart = Carbon::now('Asia/Karachi')->startOfWeek(MonitoringSetting::weekStartDay());
        $monthStart = Carbon::now('Asia/Karachi')->startOfMonth();

        if ($user->hasAnyPermission(['dashboard.view_team', 'attendance.view'])) {
            $employeesData = User::all()->map(function ($employee) use ($now, $weekStart, $monthStart) {
                $today = $employee->attendanceDateFor($now);

                // Load today's entries
                $todayEntries = $employee->timeEntries()
                    ->whereDate('action_date', $today)
                    ->orderBy('action_timestamp', 'asc')
                    ->get();

                // Load weekly entries
                $weeklyEntries = $employee->timeEntries()
                    ->where('action_date', '>=', $weekStart)
                    ->orderBy('action_timestamp', 'asc')
                    ->get();

                // Load monthly entries
                $monthlyEntries = $employee->timeEntries()
                    ->where('action_date', '>=', $monthStart)
                    ->orderBy('action_timestamp', 'asc')
                    ->get();

                return $this->calculateEmployeeStats($employee, $todayEntries, $weeklyEntries, $monthlyEntries);
            })->filter(function ($employee) {
                // Only show employees who have entries today
                return $employee['total_entries'] > 0;
            });

            return response()->json([
                'employees' => $employeesData->values(),
            ]);
        } else {
            // Regular users see only their own data
            $employee = $user;
            $today = $employee->attendanceDateFor($now);

            // Load today's entries
            $todayEntries = $employee->timeEntries()
                ->whereDate('action_date', $today)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            // Load weekly entries
            $weeklyEntries = $employee->timeEntries()
                ->where('action_date', '>=', $weekStart)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            // Load monthly entries
            $monthlyEntries = $employee->timeEntries()
                ->where('action_date', '>=', $monthStart)
                ->orderBy('action_timestamp', 'asc')
                ->get();

            return response()->json([
                'employees' => [$this->calculateEmployeeStats($employee, $todayEntries, $weeklyEntries, $monthlyEntries)],
            ]);
        }
    }

    private function calculateEmployeeStats($employee, $todayEntries, $weeklyEntries, $monthlyEntries)
    {
        // Calculate today's stats
        $todayStats = $this->calculateTimeStats($todayEntries);

        // Calculate weekly stats
        $weeklyStats = $this->calculateTimeStats($weeklyEntries);

        // Calculate monthly stats
        $monthlyStats = $this->calculateTimeStats($monthlyEntries);

        return [
            'user_id' => $employee->id,
            'user_name' => $employee->name,
            'avatar' => $employee->avatar_url ?? null,
            'designation' => $employee->designation ?? 'Employee',
            'total_work_hours' => $todayStats['workHours'],
            'total_break_hours' => $todayStats['breakHours'],
            'weekly_work_hours' => $weeklyStats['workHours'],
            'weekly_break_hours' => $weeklyStats['breakHours'],
            'monthly_work_hours' => $monthlyStats['workHours'],
            'monthly_break_hours' => $monthlyStats['breakHours'],
            'total_entries' => $todayEntries->count(),
            'last_action' => $todayStats['lastAction'],
            'current_status' => $todayStats['status'],
            'last_action_time' => $todayEntries->last()?->formatted_action_time,
        ];
    }

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
