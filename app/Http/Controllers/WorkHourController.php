<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\WorkHour;
use App\Models\User;
use App\Models\UpworkProfile;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WorkHourController extends Controller
{
    public function index(Request $request)
    {
        $user = auth()->user();
        $query = WorkHour::with('user', 'client');
        
        // WorkHoursList is for personal work diary - everyone sees only their own entries
        $query->where('user_id', $user->id);
        
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $workType = $request->input('workType', 'all');
        $tracker = $request->input('tracker', 'all');
        $client = $request->input('client', 'all');
        $perPage = $request->input('perPage', 15);
        
        // Validate perPage to prevent abuse
        $allowedPerPage = [15, 25, 50, 100];
        if (!in_array($perPage, $allowedPerPage)) {
            $perPage = 15;
        }
        
        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }
        
        // Apply work type filter
        if ($workType !== 'all') {
            $query->where('work_type', $workType);
        }
        
        // Apply tracker filter
        if ($tracker !== 'all') {
            $query->where('tracker', $tracker);
        }
        
        // Apply client filter (replacing project filter)
        if ($client !== 'all') {
            $query->whereHas('client', function($q) use ($client) {
                $q->where('name', $client);
            });
        }
        
        // Implement pagination with dynamic per page
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->paginate($perPage);
        
        // Preserve query parameters in pagination links
        $workHours->appends($request->query());
        
        return Inertia::render('WorkHoursList', [
            'workHours' => $workHours,
            'filter' => $filter,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'workType' => $workType,
            'tracker' => $tracker,
            'client' => $client,
            'perPage' => $perPage,
            'flash' => [
                'success' => $request->session()->get('success') ?? '',
                'error' => $request->session()->get('error') ?? ''
            ],
        ]);
    }

    public function create()
    {
        $clients = Client::with('upworkProfile')
            ->select('id', 'name', 'work_type', 'upwork_profile_id')
            ->orderBy('name')
            ->get();
        
        $trackers = UpworkProfile::active()
            ->orderBy('name')
            ->pluck('name')
            ->toArray();
            
        return Inertia::render('WorkHourCreate', [
            'trackers' => $trackers,
            'clients' => $clients,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'hours' => 'required|integer|min:0|max:24',
            'minutes' => 'required|integer|min:0|max:59',
            'description' => 'nullable|string',
            'work_type' => 'nullable|string',
            'client_id' => 'nullable|integer|exists:clients,id',
            'tracker' => 'nullable|string',
        ]);
        $validated['user_id'] = $request->user()->id;
        $validated['hours'] = $validated['hours'] + ($validated['minutes'] / 60);
        unset($validated['minutes']);
        WorkHour::create($validated);
        return redirect()->route('work-hours.index')
            ->with('success', 'Work hour entry created successfully.');
    }

    public function edit(WorkHour $workHour)
    {
        // Load the client relationship
        $workHour->load('client');
        
        $clients = Client::select('id', 'name')
            ->orderBy('name')
            ->get();
        
        $trackers = UpworkProfile::active()
            ->orderBy('name')
            ->pluck('name')
            ->toArray();
            
        return Inertia::render('WorkHourEdit', [
            'workHour' => $workHour,
            'trackers' => $trackers,
            'clients' => $clients,
        ]);
    }

    public function update(Request $request, WorkHour $workHour)
    {
        $validated = $request->validate([
            'date' => 'required|date',
            'hours' => 'required|integer|min:0|max:24',
            'minutes' => 'required|integer|min:0|max:59',
            'description' => 'nullable|string',
            'work_type' => 'nullable|string',
            'client_id' => 'nullable|integer|exists:clients,id',
            'tracker' => 'nullable|string',
        ]);
        $validated['hours'] = $validated['hours'] + ($validated['minutes'] / 60);
        unset($validated['minutes']);
        $workHour->update($validated);
        return redirect()->route('work-hours.index')
            ->with('success', 'Work hour entry updated successfully.');
    }

    public function destroy(WorkHour $workHour)
    {
        $workHour->delete();
        return redirect()->route('work-hours.index')->with('success', 'Work hour entry deleted.');
    }

    public function bulkDelete(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:work_hours,id'
        ]);

        $user = auth()->user();
        $ids = $validated['ids'];

        // If admin, allow deleting any entry. If not, restrict to own entries.
        if ($user->role === 'admin') {
            $deletedCount = WorkHour::whereIn('id', $ids)->delete();
        } else {
            // Ensure user can only delete their own entries
            $deletableEntries = WorkHour::whereIn('id', $ids)
                ->where('user_id', $user->id)
                ->get();

            if ($deletableEntries->count() !== count($ids)) {
                return response()->json([
                    'message' => 'Some entries could not be deleted. You can only delete your own entries.'
                ], 403);
            }

            $deletedCount = WorkHour::whereIn('id', $ids)
                ->where('user_id', $user->id)
                ->delete();
        }

        return response()->json([
            'message' => "Successfully deleted {$deletedCount} entries.",
            'deleted_count' => $deletedCount
        ]);
    }

    public function exportPersonal(Request $request)
    {
        $user = auth()->user();
        $query = WorkHour::with('user', 'client');
        
        // Only show current user's entries
        $query->where('user_id', $user->id);
        
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $workType = $request->input('workType', 'all');
        $tracker = $request->input('tracker', 'all');
        $client = $request->input('client', 'all');
        $idsOnly = $request->input('idsOnly', false);
        
        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }
        
        // Apply work type filter
        if ($workType !== 'all') {
            $query->where('work_type', $workType);
        }
        
        // Apply tracker filter
        if ($tracker !== 'all') {
            $query->where('tracker', $tracker);
        }
        
        // Apply client filter
        if ($client !== 'all') {
            $query->whereHas('client', function($q) use ($client) {
                $q->where('name', $client);
            });
        }
        
        // If only IDs are requested, return just ID and minimal data for bulk operations
        if ($idsOnly) {
            $workHours = $query->orderByDesc('date')->orderByDesc('id')->get(['id']);
        } else {
            // Get all data without pagination
            $workHours = $query->orderByDesc('date')->orderByDesc('id')->get();
        }
        
        return response()->json([
            'data' => $workHours
        ]);
    }

    public function export(Request $request)
    {
        $query = WorkHour::with('user', 'client');
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $workType = $request->input('workType', 'all');
        $userId = $request->input('userId', 'all');
        $designation = $request->input('designation', 'all');
        $tracker = $request->input('tracker', 'all');
        $client = $request->input('client', 'all');
        
        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }
        
        // Apply work type filter
        if ($workType !== 'all') {
            $query->where('work_type', $workType);
        }
        
        // Apply user filter
        if ($userId !== 'all') {
            $query->where('user_id', $userId);
        }
        
        // Apply designation filter
        if ($designation !== 'all') {
            $query->whereHas('user', function($q) use ($designation) {
                $q->where('designation', $designation);
            });
        }
        
        // Apply tracker filter
        if ($tracker !== 'all') {
            $query->where('tracker', $tracker);
        }
        
        // Apply client filter
        if ($client !== 'all') {
            $query->whereHas('client', function($q) use ($client) {
                $q->where('name', $client);
            });
        }
        
        // Get all data without pagination
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->get();
        
        return response()->json([
            'data' => $workHours
        ]);
    }

    public function report(Request $request)
    {
        $query = WorkHour::with('user', 'client');
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $workType = $request->input('workType', 'all');
        $userId = $request->input('userId', 'all');
        $designation = $request->input('designation', 'all');
        $tracker = $request->input('tracker', 'all');
        $client = $request->input('client', 'all');
        $perPage = $request->input('perPage', 15);

        // Fetch all available filter options - use UpworkProfile model
        $availableDesignations = \App\Models\User::whereNotNull('designation')
            ->distinct()
            ->pluck('designation')
            ->filter()
            ->sort()
            ->values();

        $availableTrackers = UpworkProfile::active()
            ->orderBy('name')
            ->pluck('name')
            ->toArray();

        $availableClients = \App\Models\WorkHour::with('client')
            ->whereHas('client')
            ->get()
            ->pluck('client.name')
            ->unique()
            ->filter()
            ->sort()
            ->values();
    
        // Validate perPage to prevent abuse
        $allowedPerPage = [15, 25, 50, 100];
        if (!in_array($perPage, $allowedPerPage)) {
            $perPage = 15;
        }
        
        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }
        
        // Apply work type filter
        if ($workType !== 'all') {
            $query->where('work_type', $workType);
        }
        
        // Apply user filter
        if ($userId !== 'all') {
            $query->where('user_id', $userId);
        }
        
        // Apply designation filter
        if ($designation !== 'all') {
            $query->whereHas('user', function($q) use ($designation) {
                $q->where('designation', $designation);
            });
        }
        
        // Apply tracker filter
        if ($tracker !== 'all') {
            $query->where('tracker', $tracker);
        }
        
        // Apply client filter
        if ($client !== 'all') {
            $query->whereHas('client', function($q) use ($client) {
                $q->where('name', $client);
            });
        }
        
        // Implement pagination with dynamic per page
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->paginate($perPage);
        
        // Preserve query parameters in pagination links
        $workHours->appends($request->query());
        
        $users = \App\Models\User::orderBy('name')->get(['id', 'name']);
        
        return Inertia::render('WorkHoursReport', [
            'workHours' => $workHours,
            'users' => $users,
            'filter' => $filter,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'workType' => $workType,
            'userId' => $userId,
            'designation' => $designation,
            'tracker' => $tracker,
            'client' => $client,
            'perPage' => $perPage,
            'availableDesignations' => $availableDesignations,
            'availableTrackers' => $availableTrackers,
            'availableClients' => $availableClients,
        ]);
    }
}
