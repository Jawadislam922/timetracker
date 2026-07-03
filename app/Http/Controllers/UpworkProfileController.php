<?php

namespace App\Http\Controllers;

use App\Models\UpworkProfile;
use Illuminate\Http\Request;
use Inertia\Inertia;

class UpworkProfileController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $status = $request->input('status', 'all');
        if (! in_array($status, ['all', 'active', 'archived'], true)) {
            $status = 'all';
        }

        $query = UpworkProfile::query()->orderBy('name');

        if ($status === 'active') {
            $query->active();
        } elseif ($status === 'archived') {
            $query->where('is_active', false);
        }

        $profiles = $query->get();

        return Inertia::render('UpworkProfiles/Index', [
            'profiles' => $profiles,
            'status' => $status,
        ]);
    }

    /**
     * Build the base index query from the request filters, ignoring the status filter.
     * Used by bulkStatus() so "select all matching" targets the same rows index() lists.
     */
    protected function indexQuery(Request $request)
    {
        return UpworkProfile::query()->orderBy('name');
    }

    /**
     * Update a single profile's active state (serves the inline status toggle).
     */
    public function setStatus(Request $request, UpworkProfile $upworkProfile)
    {
        $validated = $request->validate([
            'is_active' => 'required|boolean',
        ]);

        $upworkProfile->update(['is_active' => $validated['is_active']]);

        return redirect()->back()->with(
            'success',
            $validated['is_active'] ? 'Profile enabled.' : 'Profile disabled.'
        );
    }

    /**
     * Bulk enable/disable profiles by explicit ids or by all rows matching the filters.
     */
    public function bulkStatus(Request $request)
    {
        $validated = $request->validate([
            'is_active' => 'required|boolean',
            'ids' => 'nullable|array',
            'ids.*' => 'integer',
            'all_matching' => 'nullable|boolean',
        ]);

        $isActive = $request->boolean('is_active');

        if ($request->boolean('all_matching')) {
            $ids = $this->indexQuery($request)->pluck('id')->all();
        } else {
            $ids = $validated['ids'] ?? [];
        }

        $count = 0;
        if (! empty($ids)) {
            $count = UpworkProfile::whereIn('id', $ids)->update(['is_active' => $isActive]);
        }

        $verb = $isActive ? 'Enabled' : 'Disabled';
        $noun = $count === 1 ? 'profile' : 'profiles';

        return redirect()->back()->with('success', "{$verb} {$count} {$noun}.");
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        return Inertia::render('UpworkProfiles/Create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:upwork_profiles,name',
            'email' => ['nullable', 'not_regex:/[\r\n]/', 'email', 'max:255'],
            'description' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
        ]);

        UpworkProfile::create($validated);

        return redirect()->route('upwork-profiles.index')
            ->with('success', 'Upwork profile created successfully.');
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(UpworkProfile $upworkProfile)
    {
        return Inertia::render('UpworkProfiles/Edit', [
            'profile' => $upworkProfile,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, UpworkProfile $upworkProfile)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:upwork_profiles,name,'.$upworkProfile->id,
            'email' => ['nullable', 'not_regex:/[\r\n]/', 'email', 'max:255'],
            'description' => 'nullable|string|max:1000',
            'is_active' => 'boolean',
        ]);

        $upworkProfile->update($validated);

        return redirect()->route('upwork-profiles.index')
            ->with('success', 'Upwork profile updated successfully.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(UpworkProfile $upworkProfile)
    {
        $upworkProfile->delete();

        return redirect()->route('upwork-profiles.index')
            ->with('success', 'Upwork profile deleted successfully.');
    }
}
