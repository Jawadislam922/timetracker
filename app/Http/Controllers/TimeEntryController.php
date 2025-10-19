<?php

namespace App\Http\Controllers;

use App\Models\TimeEntry;
use Illuminate\Http\Request;
use Carbon\Carbon;
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
                    'user_name' => $entry->user->name
                ];
            })
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'action_type' => 'required|in:clock_in,clock_out,break_start,break_end',
            'notes' => 'nullable|string|max:255'
        ]);

        $now = Carbon::now('Asia/Karachi');
        $user = Auth::user();

        $entry = TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => $request->action_type,
            'action_timestamp' => $now,
            'action_date' => $now->toDateString(),
            'action_time' => $now->toTimeString(),
            'notes' => $request->notes
        ]);

        return response()->json([
            'entry' => [
                'id' => $entry->id,
                'action_type' => $entry->action_type,
                'action_timestamp' => $entry->action_timestamp->toISOString(),
                'formatted_date' => $entry->formatted_action_date,
                'formatted_time' => $entry->formatted_action_time,
                'notes' => $entry->notes,
                'user_name' => $user->name
            ],
            'message' => 'Time entry recorded successfully'
        ]);
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
                '"' . ($entry->notes ?? '') . '"'
            ]) . "\n";
        }

        return response($csv)
            ->header('Content-Type', 'text/csv')
            ->header('Content-Disposition', 'attachment; filename="time-entries-' . now()->format('Y-m-d') . '.csv"');
    }

    public function getTodaysEntries()
    {
        $user = Auth::user();
        $today = Carbon::today('Asia/Karachi');

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
                    'user_name' => $entry->user->name
                ];
            })
        ]);
    }

    public function getTodaysSummary()
    {
        $user = Auth::user();
        $today = Carbon::today('Asia/Karachi');
        $weekStart = Carbon::now('Asia/Karachi')->startOfWeek();
        $monthStart = Carbon::now('Asia/Karachi')->startOfMonth();

        if ($user->role === 'admin') {
            // Admins see all employees
            $employeesData = \App\Models\User::all()->map(function ($employee) use ($today, $weekStart, $monthStart) {
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
                'employees' => $employeesData->values()
            ]);
        } else {
            // Regular users see only their own data
            $employee = $user;
            
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
                'employees' => [$this->calculateEmployeeStats($employee, $todayEntries, $weeklyEntries, $monthlyEntries)]
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
            'last_action_time' => $todayEntries->last()?->formatted_action_time
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
            'status' => $status
        ];
    }
}
