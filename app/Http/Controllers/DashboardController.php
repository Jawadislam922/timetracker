<?php

namespace App\Http\Controllers;

use App\Models\WorkHour;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        
        if ($user->role === 'admin') {
            return $this->adminDashboard();
        } else {
            return $this->employeeDashboard();
        }
    }

    private function employeeDashboard()
    {
        $user = auth()->user();
        $analytics = $this->getEmployeeAnalytics($user->id);
        
        return Inertia::render('Dashboard', [
            'userRole' => 'employee',
            'analytics' => $analytics,
            'stats' => $this->getEmployeeStats($user->id)
        ]);
    }

    private function adminDashboard()
    {
        $employees = User::where('role', 'employee')->get();
        $analytics = $this->getAdminAnalytics();
        
        return Inertia::render('Dashboard', [
            'userRole' => 'admin',
            'analytics' => $analytics,
            'employees' => $employees,
            'stats' => $this->getAdminStats()
        ]);
    }

    private function getEmployeeAnalytics($userId)
    {
        $today = Carbon::today();
        $weekStart = Carbon::today()->startOfWeek();
        $monthStart = Carbon::today()->startOfMonth();

        // Today's hourly breakdown (last 24 hours by hour)
        $todayHourly = $this->getTodayHourlyData($userId);
        
        // This week's daily breakdown
        $weekDaily = $this->getWeekDailyData($userId);
        
        // This month's weekly breakdown
        $monthWeekly = $this->getMonthWeeklyData($userId);
        
        // Client distribution
        $clientDistribution = $this->getClientDistribution($userId);
        
        // Performance metrics
        $metrics = $this->getEmployeeMetrics($userId);

        return [
            'today' => [
                'hourly' => $todayHourly
            ],
            'week' => [
                'daily' => $weekDaily
            ],
            'month' => [
                'weekly' => $monthWeekly
            ],
            'clientDistribution' => $clientDistribution,
            'metrics' => $metrics,
            'summary' => [
                'today' => $this->formatHours($this->getTodayHours($userId)),
                'week' => $this->formatHours($this->getWeekHours($userId)),
                'month' => $this->formatHours($this->getMonthHours($userId))
            ]
        ];
    }

    private function getAdminAnalytics()
    {
        $today = Carbon::today();
        $employees = User::where('role', 'employee')->get();

        // Team data for different time periods
        $teamData = [
            'daily' => $this->getTeamDailyData(),
            'weekly' => $this->getTeamWeeklyData(),
            'monthly' => $this->getTeamMonthlyData()
        ];

        // Individual employee data
        $employeeData = [];
        foreach ($employees as $employee) {
            $employeeData[$employee->id] = [
                'daily' => $this->getEmployeeDailyData($employee->id),
                'weekly' => $this->getEmployeeWeeklyData($employee->id),
                'monthly' => $this->getEmployeeMonthlyData($employee->id)
            ];
        }

        // Employee comparison
        $employeeComparison = $this->getEmployeeComparison();
        
        // Top performers
        $topPerformers = $this->getTopPerformers();

        return [
            'teamData' => $teamData,
            'employeeData' => $employeeData,
            'employeeComparison' => $employeeComparison,
            'topPerformers' => $topPerformers,
            'summary' => [
                'totalToday' => $this->formatHours($this->getTotalTeamHoursToday()),
                'activeEmployees' => $this->getActiveEmployeesToday(),
                'averageHours' => $this->formatHours($this->getAverageEmployeeHours()),
                'teamEfficiency' => $this->getTeamEfficiency()
            ]
        ];
    }

    private function getTodayHourlyData($userId)
    {
        // Get today's work entries and create hourly breakdown
        $hours = range(8, 18); // 8 AM to 6 PM
        $labels = array_map(fn($h) => sprintf('%02d:00', $h), $hours);
        
        // This is a simplified version - you might want to track actual start/end times
        $todayHours = WorkHour::where('user_id', $userId)
            ->where('date', Carbon::today()->format('Y-m-d'))
            ->sum('hours');
        
        // Distribute hours across the day (simplified)
        $data = array_fill(0, count($hours), 0);
        if ($todayHours > 0) {
            $hoursPerSlot = $todayHours / min(8, $todayHours); // Spread across 8 hours max
            for ($i = 0; $i < min(8, $todayHours); $i++) {
                $data[$i] = round($hoursPerSlot, 1);
            }
        }

        return [
            'labels' => $labels,
            'data' => $data
        ];
    }

    private function getWeekDailyData($userId)
    {
        $weekStart = Carbon::today()->startOfWeek();
        $days = [];
        $data = [];
        
        for ($i = 0; $i < 7; $i++) {
            $date = $weekStart->copy()->addDays($i);
            $days[] = $date->format('D');
            
            $hours = WorkHour::where('user_id', $userId)
                ->where('date', $date->format('Y-m-d'))
                ->sum('hours');
            $data[] = round($hours, 1);
        }

        return [
            'labels' => $days,
            'data' => $data
        ];
    }

    private function getMonthWeeklyData($userId)
    {
        $monthStart = Carbon::today()->startOfMonth();
        $weeks = [];
        $data = [];
        
        $currentWeekStart = $monthStart->copy()->startOfWeek();
        $weekNumber = 1;
        
        while ($currentWeekStart->month <= Carbon::today()->month && $weekNumber <= 5) {
            $weekEnd = $currentWeekStart->copy()->endOfWeek();
            $weeks[] = "Week {$weekNumber}";
            
            $hours = WorkHour::where('user_id', $userId)
                ->whereBetween('date', [
                    $currentWeekStart->format('Y-m-d'),
                    $weekEnd->format('Y-m-d')
                ])
                ->sum('hours');
            $data[] = round($hours, 1);
            
            $currentWeekStart->addWeek();
            $weekNumber++;
        }

        return [
            'labels' => $weeks,
            'data' => $data
        ];
    }

    private function getClientDistribution($userId)
    {
        $monthStart = Carbon::today()->startOfMonth();
        
        $clientHours = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), Carbon::today()->format('Y-m-d')])
            ->join('clients', 'work_hours.client_id', '=', 'clients.id')
            ->select('clients.name', DB::raw('SUM(work_hours.hours) as total_hours'))
            ->groupBy('clients.id', 'clients.name')
            ->orderBy('total_hours', 'desc')
            ->take(6)
            ->get();

        return [
            'labels' => $clientHours->pluck('name')->toArray(),
            'data' => $clientHours->pluck('total_hours')->map(fn($h) => round($h, 1))->toArray()
        ];
    }

    private function getEmployeeMetrics($userId)
    {
        $monthStart = Carbon::today()->startOfMonth();
        
        // Average daily hours
        $totalHours = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), Carbon::today()->format('Y-m-d')])
            ->sum('hours');
        $workDays = $this->getWorkDaysInMonth($monthStart, Carbon::today());
        $avgDailyHours = $workDays > 0 ? round($totalHours / $workDays, 1) : 0;
        
        // Total clients
        $totalClients = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), Carbon::today()->format('Y-m-d')])
            ->distinct('client_id')
            ->count('client_id');
        
        // Consistency (days worked vs work days)
        $daysWorked = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), Carbon::today()->format('Y-m-d')])
            ->distinct('date')
            ->count('date');
        $consistency = $workDays > 0 ? round(($daysWorked / $workDays) * 100) : 0;
        
        // Productivity (hours vs expected hours)
        $expectedHours = $workDays * 8; // Assuming 8 hours per day
        $productivity = $expectedHours > 0 ? round(($totalHours / $expectedHours) * 100) : 0;

        return [
            'avgDailyHours' => $avgDailyHours,
            'totalClients' => $totalClients,
            'consistency' => $consistency,
            'productivity' => min(100, $productivity) // Cap at 100%
        ];
    }

    private function getTeamDailyData()
    {
        $days = [];
        $totalHours = [];
        $averageHours = [];
        
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $days[] = $date->format('M j');
            
            $dayTotal = WorkHour::whereDate('date', $date)
                ->sum('hours');
            $totalHours[] = round($dayTotal, 1);
            
            $employeeCount = User::where('role', 'employee')->count();
            $averageHours[] = $employeeCount > 0 ? round($dayTotal / $employeeCount, 1) : 0;
        }

        return [
            'labels' => $days,
            'totalHours' => $totalHours,
            'averageHours' => $averageHours
        ];
    }

    private function getTeamWeeklyData()
    {
        $weeks = [];
        $data = [];
        
        for ($i = 3; $i >= 0; $i--) {
            $weekStart = Carbon::today()->subWeeks($i)->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();
            $weeks[] = $weekStart->format('M j') . '-' . $weekEnd->format('j');
            
            $weekTotal = WorkHour::whereBetween('date', [
                $weekStart->format('Y-m-d'),
                $weekEnd->format('Y-m-d')
            ])->sum('hours');
            $data[] = round($weekTotal, 1);
        }

        return [
            'labels' => $weeks,
            'data' => $data
        ];
    }

    private function getTeamMonthlyData()
    {
        $months = [];
        $data = [];
        
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = Carbon::today()->subMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();
            $months[] = $monthStart->format('M Y');
            
            $monthTotal = WorkHour::whereBetween('date', [
                $monthStart->format('Y-m-d'),
                $monthEnd->format('Y-m-d')
            ])->sum('hours');
            $data[] = round($monthTotal, 1);
        }

        return [
            'labels' => $months,
            'data' => $data
        ];
    }

    private function getEmployeeComparison()
    {
        $monthStart = Carbon::today()->startOfMonth();
        
        $employeeHours = User::where('role', 'employee')
            ->leftJoin('work_hours', function($join) use ($monthStart) {
                $join->on('users.id', '=', 'work_hours.user_id')
                     ->whereBetween('work_hours.date', [
                         $monthStart->format('Y-m-d'),
                         Carbon::today()->format('Y-m-d')
                     ]);
            })
            ->select('users.name', DB::raw('COALESCE(SUM(work_hours.hours), 0) as total_hours'))
            ->groupBy('users.id', 'users.name')
            ->orderBy('total_hours', 'desc')
            ->get();

        return [
            'labels' => $employeeHours->pluck('name')->toArray(),
            'data' => $employeeHours->pluck('total_hours')->map(fn($h) => round($h, 1))->toArray()
        ];
    }

    private function getTopPerformers()
    {
        $monthStart = Carbon::today()->startOfMonth();
        
        return User::where('role', 'employee')
            ->leftJoin('work_hours', function($join) use ($monthStart) {
                $join->on('users.id', '=', 'work_hours.user_id')
                     ->whereBetween('work_hours.date', [
                         $monthStart->format('Y-m-d'),
                         Carbon::today()->format('Y-m-d')
                     ]);
            })
            ->select(
                'users.id',
                'users.name',
                'users.designation',
                DB::raw('COALESCE(SUM(work_hours.hours), 0) as hours_this_month')
            )
            ->groupBy('users.id', 'users.name', 'users.designation')
            ->orderBy('hours_this_month', 'desc')
            ->take(6)
            ->get()
            ->map(function($user) {
                $workDays = $this->getWorkDaysInMonth(Carbon::today()->startOfMonth(), Carbon::today());
                $expectedHours = $workDays * 8;
                $efficiency = $expectedHours > 0 ? min(100, round(($user->hours_this_month / $expectedHours) * 100)) : 0;
                
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'designation' => $user->designation ?: 'Employee',
                    'hoursThisMonth' => round($user->hours_this_month, 1),
                    'efficiency' => $efficiency
                ];
            });
    }

    // Helper methods for getting individual metrics
    private function getTodayHours($userId)
    {
        return WorkHour::where('user_id', $userId)
            ->where('date', Carbon::today()->format('Y-m-d'))
            ->sum('hours');
    }

    private function getWeekHours($userId)
    {
        $weekStart = Carbon::today()->startOfWeek();
        $weekEnd = Carbon::today()->endOfWeek();
        
        return WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d')])
            ->sum('hours');
    }

    private function getMonthHours($userId)
    {
        $monthStart = Carbon::today()->startOfMonth();
        
        return WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), Carbon::today()->format('Y-m-d')])
            ->sum('hours');
    }

    private function getTotalTeamHoursToday()
    {
        return WorkHour::where('date', Carbon::today()->format('Y-m-d'))->sum('hours');
    }

    private function getActiveEmployeesToday()
    {
        return WorkHour::where('date', Carbon::today()->format('Y-m-d'))
            ->distinct('user_id')
            ->count('user_id');
    }

    private function getAverageEmployeeHours()
    {
        $monthStart = Carbon::today()->startOfMonth();
        $totalHours = WorkHour::whereBetween('date', [
            $monthStart->format('Y-m-d'),
            Carbon::today()->format('Y-m-d')
        ])->sum('hours');
        
        $employeeCount = User::where('role', 'employee')->count();
        return $employeeCount > 0 ? $totalHours / $employeeCount : 0;
    }

    private function getTeamEfficiency()
    {
        $monthStart = Carbon::today()->startOfMonth();
        $workDays = $this->getWorkDaysInMonth($monthStart, Carbon::today());
        $employeeCount = User::where('role', 'employee')->count();
        $expectedTotalHours = $workDays * $employeeCount * 8;
        
        $actualTotalHours = WorkHour::whereBetween('date', [
            $monthStart->format('Y-m-d'),
            Carbon::today()->format('Y-m-d')
        ])->sum('hours');
        
        return $expectedTotalHours > 0 ? round(($actualTotalHours / $expectedTotalHours) * 100) : 0;
    }

    // Helper methods for individual employee data (for admin view)
    private function getEmployeeDailyData($employeeId)
    {
        $days = [];
        $data = [];
        
        for ($i = 6; $i >= 0; $i--) {
            $date = Carbon::today()->subDays($i);
            $days[] = $date->format('M j');
            
            $hours = WorkHour::where('user_id', $employeeId)
                ->where('date', $date->format('Y-m-d'))
                ->sum('hours');
            $data[] = round($hours, 1);
        }

        return [
            'labels' => $days,
            'data' => $data
        ];
    }

    private function getEmployeeWeeklyData($employeeId)
    {
        $weeks = [];
        $data = [];
        
        for ($i = 3; $i >= 0; $i--) {
            $weekStart = Carbon::today()->subWeeks($i)->startOfWeek();
            $weekEnd = $weekStart->copy()->endOfWeek();
            $weeks[] = $weekStart->format('M j') . '-' . $weekEnd->format('j');
            
            $hours = WorkHour::where('user_id', $employeeId)
                ->whereBetween('date', [
                    $weekStart->format('Y-m-d'),
                    $weekEnd->format('Y-m-d')
                ])
                ->sum('hours');
            $data[] = round($hours, 1);
        }

        return [
            'labels' => $weeks,
            'data' => $data
        ];
    }

    private function getEmployeeMonthlyData($employeeId)
    {
        $months = [];
        $data = [];
        
        for ($i = 5; $i >= 0; $i--) {
            $monthStart = Carbon::today()->subMonths($i)->startOfMonth();
            $monthEnd = $monthStart->copy()->endOfMonth();
            $months[] = $monthStart->format('M Y');
            
            $hours = WorkHour::where('user_id', $employeeId)
                ->whereBetween('date', [
                    $monthStart->format('Y-m-d'),
                    $monthEnd->format('Y-m-d')
                ])
                ->sum('hours');
            $data[] = round($hours, 1);
        }

        return [
            'labels' => $months,
            'data' => $data
        ];
    }

    // Legacy methods for basic stats
    private function getEmployeeStats($userId)
    {
        $today = Carbon::today();
        $weekStart = Carbon::today()->startOfWeek();
        $weekEnd = Carbon::today()->endOfWeek();
        $monthStart = Carbon::today()->startOfMonth();

        $thisWeekHours = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$weekStart->format('Y-m-d'), $weekEnd->format('Y-m-d')])
            ->sum('hours');

        $thisMonthClients = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), $today->format('Y-m-d')])
            ->distinct('client_id')
            ->count('client_id');

        $workDaysThisMonth = $this->getWorkDaysInMonth($monthStart, $today);
        $daysWithHours = WorkHour::where('user_id', $userId)
            ->whereBetween('date', [$monthStart->format('Y-m-d'), $today->format('Y-m-d')])
            ->distinct('date')
            ->count('date');

        $efficiency = $workDaysThisMonth > 0 ? round(($daysWithHours / $workDaysThisMonth) * 100) : 0;

        return [
            'weekHours' => [
                'value' => $this->formatHours($thisWeekHours),
                'label' => 'This Week'
            ],
            'activeClients' => [
                'value' => $thisMonthClients,
                'label' => 'Active Clients'
            ],
            'efficiency' => [
                'value' => "{$efficiency}%",
                'label' => 'Efficiency'
            ]
        ];
    }

    private function getAdminStats()
    {
        $today = Carbon::today();
        $monthStart = Carbon::today()->startOfMonth();

        $totalHoursToday = WorkHour::where('date', $today->format('Y-m-d'))->sum('hours');
        $activeEmployees = User::where('role', 'employee')->count();
        $totalClients = Client::count();
        $teamEfficiency = $this->getTeamEfficiency();

        return [
            'totalHours' => [
                'value' => $this->formatHours($totalHoursToday),
                'label' => 'Total Hours Today'
            ],
            'activeEmployees' => [
                'value' => $activeEmployees,
                'label' => 'Total Employees'
            ],
            'totalClients' => [
                'value' => $totalClients,
                'label' => 'Total Clients'
            ],
            'teamEfficiency' => [
                'value' => "{$teamEfficiency}%",
                'label' => 'Team Efficiency'
            ]
        ];
    }
    
    private function formatHours($decimal)
    {
        if ($decimal == 0) return '0h';
        
        $hours = floor($decimal);
        $minutes = round(($decimal - $hours) * 60);
        
        if ($minutes == 0) {
            return $hours . 'h';
        } elseif ($minutes == 30) {
            return $hours . '.5h';
        } else {
            return $hours . 'h ' . $minutes . 'm';
        }
    }
    
    private function getWorkDaysInMonth($start, $end)
    {
        $workDays = 0;
        $current = $start->copy();
        
        while ($current->lte($end)) {
            // Count Monday to Friday as work days
            if ($current->isWeekday()) {
                $workDays++;
            }
            $current->addDay();
        }
        
        return $workDays;
    }
}
