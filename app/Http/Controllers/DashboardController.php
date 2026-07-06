<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

class DashboardController extends Controller
{
    /**
     * The dashboard is fully client-driven. Dashboard.jsx fetches everything it
     * shows from the live endpoints — /time-entries/today (personal punches),
     * /time-entries/today-summary (team KPIs + needs-attention + rows), and
     * /time-entries/dashboard-trend (the at-a-glance chart) — and reads only the
     * globally-shared auth/display props from HandleInertiaRequests. So the page
     * itself needs no server-computed props.
     *
     * This controller used to also build a large work_hours-based `analytics`
     * payload (getAdminAnalytics/getEmployeeAnalytics) plus `stats`/`employees`/
     * `userRole` props. None of those were consumed by the rewritten page, so
     * the whole pipeline was dead and has been removed (Stage 5 cleanup).
     */
    public function index()
    {
        // The only server prop the page needs: the curated shift list, so the
        // team panel's shift filter can be built without an extra round-trip.
        return Inertia::render('Dashboard', [
            'shiftOptions' => \App\Models\Shift::orderBy('sort_order')->orderBy('name')->get(['id', 'name']),
        ]);
    }
}
