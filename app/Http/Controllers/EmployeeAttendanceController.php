<?php

namespace App\Http\Controllers;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EmployeeAttendanceController extends Controller
{
    /**
     * Display the employee attendance page
     */
    public function index()
    {
        return Inertia::render('EmployeeAttendance', [
            'serverDate' => Carbon::today('Asia/Karachi')->toDateString(),
        ]);
    }

    /**
     * Get summary view data
     */
    public function getSummary(Request $request)
    {
        $date = $request->input('date', Carbon::today('Asia/Karachi')->toDateString());

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
        $date = $request->input('date', Carbon::today('Asia/Karachi')->toDateString());

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
        $date = $request->input('date', Carbon::today('Asia/Karachi')->toDateString());

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
        $date = $request->input('date', Carbon::today('Asia/Karachi')->toDateString());

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
            $entryTime = new Carbon($entry->action_timestamp);
            $lastAction = $entry->action_type;

            switch ($entry->action_type) {
                case 'clock_in':
                    $currentSessionStart = $entryTime;
                    $status = 'Working';
                    break;
                case 'clock_out':
                    if ($currentSessionStart) {
                        $totalWorkMinutes += $entryTime->diffInMinutes($currentSessionStart);
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
                        $totalBreakMinutes += $entryTime->diffInMinutes($currentBreakStart);
                        $currentBreakStart = null;
                    }
                    $status = 'Working';
                    break;
            }
        }

        // If still clocked in, add time until now
        if ($currentSessionStart) {
            $totalWorkMinutes += Carbon::now('Asia/Karachi')->diffInMinutes($currentSessionStart);
        }

        // If still on break, add break time until now
        if ($currentBreakStart) {
            $totalBreakMinutes += Carbon::now('Asia/Karachi')->diffInMinutes($currentBreakStart);
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
            $entryTime = new Carbon($entry->action_timestamp);

            switch ($entry->action_type) {
                case 'clock_in':
                    $currentWorkStart = $entryTime;
                    break;

                case 'clock_out':
                    if ($currentWorkStart) {
                        $duration = $currentWorkStart->diff($entryTime);
                        $sessions[] = [
                            'type' => 'work',
                            'start_time' => $currentWorkStart->format('g:i A'),
                            'end_time' => $entryTime->format('g:i A'),
                            'duration' => $this->formatDuration($duration),
                        ];
                        $currentWorkStart = null;
                    }
                    break;

                case 'break_start':
                    $currentBreakStart = $entryTime;
                    break;

                case 'break_end':
                    if ($currentBreakStart) {
                        $duration = $currentBreakStart->diff($entryTime);
                        $sessions[] = [
                            'type' => 'break',
                            'start_time' => $currentBreakStart->format('g:i A'),
                            'end_time' => $entryTime->format('g:i A'),
                            'duration' => $this->formatDuration($duration),
                        ];
                        $currentBreakStart = null;
                    }
                    break;
            }
        }

        // Add ongoing session if exists
        if ($currentWorkStart) {
            $duration = $currentWorkStart->diff(Carbon::now('Asia/Karachi'));
            $sessions[] = [
                'type' => 'work',
                'start_time' => $currentWorkStart->format('g:i A'),
                'end_time' => null,
                'duration' => $this->formatDuration($duration).' (ongoing)',
            ];
        }

        if ($currentBreakStart) {
            $duration = $currentBreakStart->diff(Carbon::now('Asia/Karachi'));
            $sessions[] = [
                'type' => 'break',
                'start_time' => $currentBreakStart->format('g:i A'),
                'end_time' => null,
                'duration' => $this->formatDuration($duration).' (ongoing)',
            ];
        }

        return $sessions;
    }

    /**
     * Format duration in human readable format
     */
    private function formatDuration($duration)
    {
        $hours = $duration->h;
        $minutes = $duration->i;

        if ($hours > 0) {
            return "{$hours}h {$minutes}m";
        }

        return "{$minutes}m";
    }
}
