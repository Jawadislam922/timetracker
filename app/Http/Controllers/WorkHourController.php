<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\MonitoringSetting;
use App\Models\UpworkProfile;
use App\Models\User;
use App\Models\WorkHour;
use App\Services\SlackReportService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class WorkHourController extends Controller
{
    private const WORK_TYPES = [
        'tracker',
        'manual',
        'fixed',
        'outside_of_upwork',
        'office_work',
        'test_task',
    ];

    private function authorizeWorkHourAccess(WorkHour $workHour): void
    {
        $user = auth()->user();

        if (! $user->hasPermission('work_hours.manage_all') && $workHour->user_id !== $user->id) {
            abort(403, 'You can only manage your own work hour entries.');
        }
    }

    /**
     * Manual work-hour entry is always available to Admin/Super Admin (anyone
     * who can manage all entries). For regular Members it depends on the team
     * `allow_offline_time` setting from the new Settings page.
     */
    private function ensureCanCreateManual(): void
    {
        $user = auth()->user();

        if ($user->isSuperAdmin() || $user->hasPermission('work_hours.manage_all')) {
            return;
        }

        if (! MonitoringSetting::current()->allow_offline_time) {
            abort(403, 'Manual work-hour entry is disabled by your administrator.');
        }
    }

    private function filterValues(Request $request, string $key, ?string $legacyKey = null): array
    {
        $value = $request->input($key);

        if ($value === null && $legacyKey) {
            $value = $request->input($legacyKey);
        }

        if ($value === null) {
            return [];
        }

        if (! is_array($value)) {
            $value = [$value];
        }

        return collect($value)
            ->flatten()
            ->map(fn ($item) => trim((string) $item))
            ->filter(fn ($item) => $item !== '' && $item !== 'all')
            ->unique()
            ->values()
            ->all();
    }

    private function applyCommonFilters($query, array $filters): void
    {
        if (! empty($filters['workTypes'])) {
            $query->whereIn('work_type', $filters['workTypes']);
        }

        if (! empty($filters['trackers'])) {
            $query->whereIn('tracker', $filters['trackers']);
        }

        if (! empty($filters['clients'])) {
            $query->whereHas('client', function ($q) use ($filters) {
                $q->whereIn('name', $filters['clients']);
            });
        }

        if (! empty($filters['userIds'])) {
            $query->whereIn('user_id', $filters['userIds']);
        }

        if (! empty($filters['designations'])) {
            $query->whereHas('user', function ($q) use ($filters) {
                $q->whereIn('designation', $filters['designations']);
            });
        }
    }

    private function firstLegacyValue(array $values): string
    {
        return $values[0] ?? 'all';
    }

    private function redirectToReturnPath(Request $request, string $fallbackRoute, array $flash = [])
    {
        $returnTo = $request->input('return_to');
        $redirect = is_string($returnTo)
            && str_starts_with($returnTo, '/')
            && ! str_starts_with($returnTo, '//')
                ? redirect($returnTo)
                : redirect()->route($fallbackRoute);

        foreach ($flash as $key => $value) {
            $redirect->with($key, $value);
        }

        return $redirect;
    }

    public function index(Request $request)
    {
        $user = auth()->user();
        $query = WorkHour::with('user', 'client');

        // WorkHoursList is for personal work diary - everyone sees only their own entries
        $query->where('user_id', $user->id);

        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $selectedWorkTypes = $this->filterValues($request, 'workTypes', 'workType');
        $selectedTrackers = $this->filterValues($request, 'trackers', 'tracker');
        $selectedClients = $this->filterValues($request, 'clients', 'client');
        $perPage = $request->input('perPage', 15);

        // Validate perPage to prevent abuse
        $allowedPerPage = [15, 25, 50, 100];
        if (! in_array($perPage, $allowedPerPage)) {
            $perPage = 15;
        }

        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        $this->applyCommonFilters($query, [
            'workTypes' => $selectedWorkTypes,
            'trackers' => $selectedTrackers,
            'clients' => $selectedClients,
        ]);

        // Implement pagination with dynamic per page
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->paginate($perPage);

        // Preserve query parameters in pagination links
        $workHours->appends($request->query());

        $availableClients = WorkHour::with('client')
            ->where('user_id', $user->id)
            ->whereHas('client')
            ->get()
            ->pluck('client.name')
            ->unique()
            ->filter()
            ->sort()
            ->values();

        $availableTrackers = WorkHour::where('user_id', $user->id)
            ->whereNotNull('tracker')
            ->distinct()
            ->pluck('tracker')
            ->filter()
            ->sort()
            ->values();

        return Inertia::render('WorkHoursList', [
            'workHours' => $workHours,
            'filter' => $filter,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'workType' => $this->firstLegacyValue($selectedWorkTypes),
            'tracker' => $this->firstLegacyValue($selectedTrackers),
            'client' => $this->firstLegacyValue($selectedClients),
            'perPage' => $perPage,
            'selectedFilters' => [
                'workTypes' => $selectedWorkTypes,
                'trackers' => $selectedTrackers,
                'clients' => $selectedClients,
            ],
            'filterOptions' => [
                'workTypes' => self::WORK_TYPES,
                'trackers' => $availableTrackers,
                'clients' => $availableClients,
            ],
            'flash' => [
                'success' => $request->session()->get('success') ?? '',
                'error' => $request->session()->get('error') ?? '',
            ],
        ]);
    }

    public function create()
    {
        $this->ensureCanCreateManual();

        $clients = Client::with(['upworkProfile', 'upworkProfiles'])
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
        $this->ensureCanCreateManual();

        $validated = $request->validate([
            'date' => 'required|date',
            'hours' => 'required|integer|min:0|max:24',
            'minutes' => 'required|integer|min:0|max:59',
            'description' => 'required|string|max:5000',
            'work_type' => ['required', Rule::in(self::WORK_TYPES)],
            'client_id' => 'nullable|integer|exists:clients,id',
            'tracker' => 'nullable|string|max:255',
        ]);

        if ((int) $validated['hours'] === 0 && (int) $validated['minutes'] === 0) {
            return back()->withErrors(['hours' => 'Please enter at least some time.']);
        }

        $validated['user_id'] = $request->user()->id;
        $validated['hours'] = $validated['hours'] + ($validated['minutes'] / 60);
        $validated['source'] = 'manual';
        unset($validated['minutes']);
        WorkHour::create($validated);

        return redirect()->route('work-hours.index')
            ->with('success', 'Work hour entry created successfully.');
    }

    public function edit(WorkHour $workHour)
    {
        $this->authorizeWorkHourAccess($workHour);

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
        $this->authorizeWorkHourAccess($workHour);

        $validated = $request->validate([
            'date' => 'required|date',
            'hours' => 'required|integer|min:0|max:24',
            'minutes' => 'required|integer|min:0|max:59',
            'description' => 'required|string|max:5000',
            'work_type' => ['required', Rule::in(self::WORK_TYPES)],
            'client_id' => 'nullable|integer|exists:clients,id',
            'tracker' => 'nullable|string|max:255',
        ]);

        if ((int) $validated['hours'] === 0 && (int) $validated['minutes'] === 0) {
            return back()->withErrors(['hours' => 'Please enter at least some time.']);
        }

        $validated['hours'] = $validated['hours'] + ($validated['minutes'] / 60);
        unset($validated['minutes']);
        $workHour->update($validated);

        return redirect()->route('work-hours.index')
            ->with('success', 'Work hour entry updated successfully.');
    }

    public function destroy(Request $request, WorkHour $workHour)
    {
        $this->authorizeWorkHourAccess($workHour);

        $workHour->delete();

        return $this->redirectToReturnPath($request, 'work-hours.index', [
            'success' => 'Work hour entry deleted.',
        ]);
    }

    public function bulkDelete(Request $request)
    {
        if ($request->has('entry_ids') && ! $request->has('ids')) {
            $request->merge(['ids' => $request->input('entry_ids')]);
        }

        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'integer|exists:work_hours,id',
        ]);

        $user = auth()->user();
        $ids = $validated['ids'];

        if ($user->hasPermission('work_hours.manage_all')) {
            $deletedCount = WorkHour::whereIn('id', $ids)->delete();
        } else {
            // Ensure user can only delete their own entries.
            $ownCount = WorkHour::whereIn('id', $ids)
                ->where('user_id', $user->id)
                ->count();

            if ($ownCount !== count($ids)) {
                // Inertia requests must get a redirect/validation response, not
                // plain JSON — surface the failure as a form error.
                return back()->withErrors([
                    'ids' => 'Some entries could not be deleted. You can only delete your own entries.',
                ]);
            }

            $deletedCount = WorkHour::whereIn('id', $ids)
                ->where('user_id', $user->id)
                ->delete();
        }

        return back()->with('success', "Successfully deleted {$deletedCount} entries.");
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
        $selectedWorkTypes = $this->filterValues($request, 'workTypes', 'workType');
        $selectedTrackers = $this->filterValues($request, 'trackers', 'tracker');
        $selectedClients = $this->filterValues($request, 'clients', 'client');
        $idsOnly = $request->input('idsOnly', false);

        // Apply date filter
        if ($filter !== 'all' && $startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        $this->applyCommonFilters($query, [
            'workTypes' => $selectedWorkTypes,
            'trackers' => $selectedTrackers,
            'clients' => $selectedClients,
        ]);

        // If only IDs are requested, return just ID and minimal data for bulk operations
        if ($idsOnly) {
            $workHours = $query->orderByDesc('date')->orderByDesc('id')->get(['id']);
        } else {
            // Get all data without pagination
            $workHours = $query->orderByDesc('date')->orderByDesc('id')->get();
        }

        return response()->json([
            'data' => $workHours,
        ]);
    }

    public function export(Request $request)
    {
        $query = WorkHour::with('user', 'client');
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $selectedWorkTypes = $this->filterValues($request, 'workTypes', 'workType');
        $selectedUserIds = $this->filterValues($request, 'userIds', 'userId');
        $selectedDesignations = $this->filterValues($request, 'designations', 'designation');
        $selectedTrackers = $this->filterValues($request, 'trackers', 'tracker');
        $selectedClients = $this->filterValues($request, 'clients', 'client');

        // Apply date filter - only apply if both dates are provided
        if ($startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        $this->applyCommonFilters($query, [
            'workTypes' => $selectedWorkTypes,
            'userIds' => $selectedUserIds,
            'designations' => $selectedDesignations,
            'trackers' => $selectedTrackers,
            'clients' => $selectedClients,
        ]);

        // Get all data without pagination
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->get();

        return response()->json([
            'data' => $workHours,
        ]);
    }

    public function report(Request $request, SlackReportService $slack)
    {
        $query = WorkHour::with('user', 'client');
        $filter = $request->input('filter', 'all');
        $startDate = $request->input('startDate');
        $endDate = $request->input('endDate');
        $selectedWorkTypes = $this->filterValues($request, 'workTypes', 'workType');
        $selectedUserIds = $this->filterValues($request, 'userIds', 'userId');
        $selectedDesignations = $this->filterValues($request, 'designations', 'designation');
        $selectedTrackers = $this->filterValues($request, 'trackers', 'tracker');
        $selectedClients = $this->filterValues($request, 'clients', 'client');
        $perPage = $request->input('perPage', 15);

        // Fetch all available designation filter options.
        $availableDesignations = User::whereNotNull('designation')
            ->distinct()
            ->pluck('designation')
            ->filter()
            ->sort()
            ->values();

        $availableTrackers = UpworkProfile::active()
            ->orderBy('name')
            ->pluck('name')
            ->toArray();

        // One indexed query for the dropdown — the previous shape hydrated
        // every work_hours row with its client just to list distinct names.
        $availableClients = Client::query()
            ->whereIn('id', WorkHour::whereNotNull('client_id')->select('client_id')->distinct())
            ->orderBy('name')
            ->pluck('name')
            ->values();

        // Validate perPage to prevent abuse
        $allowedPerPage = [15, 25, 50, 100];
        if (! in_array($perPage, $allowedPerPage)) {
            $perPage = 15;
        }

        // Apply date filter - only apply if both dates are provided
        if ($startDate && $endDate) {
            $query->whereBetween('date', [$startDate, $endDate]);
        }

        $this->applyCommonFilters($query, [
            'workTypes' => $selectedWorkTypes,
            'userIds' => $selectedUserIds,
            'designations' => $selectedDesignations,
            'trackers' => $selectedTrackers,
            'clients' => $selectedClients,
        ]);

        // Implement pagination with dynamic per page
        $workHours = $query->orderByDesc('date')->orderByDesc('id')->paginate($perPage);

        // Preserve query parameters in pagination links
        $workHours->appends($request->query());

        $users = User::orderBy('name')->get(['id', 'name', 'include_in_slack_reports']);

        return Inertia::render('WorkHoursReport', [
            'workHours' => $workHours,
            'users' => $users,
            'filter' => $filter,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'workType' => $this->firstLegacyValue($selectedWorkTypes),
            'userId' => $this->firstLegacyValue($selectedUserIds),
            'designation' => $this->firstLegacyValue($selectedDesignations),
            'tracker' => $this->firstLegacyValue($selectedTrackers),
            'client' => $this->firstLegacyValue($selectedClients),
            'perPage' => $perPage,
            'availableDesignations' => $availableDesignations,
            'availableTrackers' => $availableTrackers,
            'availableClients' => $availableClients,
            'selectedFilters' => [
                'workTypes' => $selectedWorkTypes,
                'userIds' => $selectedUserIds,
                'designations' => $selectedDesignations,
                'trackers' => $selectedTrackers,
                'clients' => $selectedClients,
            ],
            'filterOptions' => [
                'workTypes' => self::WORK_TYPES,
                'users' => $users,
                'designations' => $availableDesignations,
                'trackers' => $availableTrackers,
                'clients' => $availableClients,
            ],
            'slackConfigured' => $slack->configured(),
            'slackWeeklyEnabled' => (bool) config('services.slack_reports.weekly_enabled'),
            'flash' => [
                'success' => $request->session()->get('success') ?? '',
                'error' => $request->session()->get('error') ?? '',
            ],
        ]);
    }
}
