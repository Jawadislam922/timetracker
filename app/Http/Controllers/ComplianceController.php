<?php

namespace App\Http\Controllers;

use App\Models\MachineReport;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Machine Compliance — what's installed/running on every PC, with the
 * automation/VPN blocklist hits surfaced first. Lets a manager answer "is any
 * machine running a refresh tool / scraper / jiggler / VPN that could get an
 * Upwork profile banned?" from one page instead of visiting each desk.
 */
class ComplianceController extends Controller
{
    private const SEV_ORDER = ['critical' => 0, 'high' => 1, 'warn' => 2];

    public function index(Request $request): Response
    {
        // Latest report per (machine, kind) — the current picture.
        $latestIds = MachineReport::selectRaw('MAX(id) as id')
            ->groupBy('user_id', 'device_name', 'kind')
            ->pluck('id');

        $reports = MachineReport::with('user:id,name')->whereIn('id', $latestIds)->get();

        $machines = $reports->groupBy(fn ($r) => $r->device_name.'|'.$r->user_id)->map(function ($g) {
            $first = $g->first();

            return [
                'device' => $first->device_name ?: 'unknown',
                'user' => $first->user?->name,
                'app_version' => $first->app_version,
                'last_seen' => optional($g->max('collected_at') ?? $g->max('created_at'))->toDateTimeString(),
                'counts' => $g->mapWithKeys(fn ($r) => [$r->kind => (int) $r->item_count])->all(),
                'flagged_count' => (int) $g->sum('flagged_count'),
            ];
        })->sortByDesc('flagged_count')->values();

        $flags = [];
        foreach ($reports as $r) {
            foreach (($r->flagged ?? []) as $f) {
                $flags[] = [
                    'device' => $r->device_name ?: 'unknown',
                    'user' => $r->user?->name,
                    'kind' => $r->kind,
                    'item' => $f['name'] ?? $f['title'] ?? $f['process'] ?? $f['path'] ?? 'unknown',
                    'rule' => $f['rule'] ?? '?',
                    'severity' => $f['severity'] ?? 'warn',
                    'seen' => optional($r->collected_at)->toDateTimeString(),
                ];
            }
        }
        usort($flags, fn ($a, $b) => (self::SEV_ORDER[$a['severity']] ?? 3) <=> (self::SEV_ORDER[$b['severity']] ?? 3));

        return Inertia::render('Monitoring/Compliance', [
            'machines' => $machines,
            'flags' => $flags,
            'summary' => [
                'machines' => $machines->count(),
                'flagged_machines' => $machines->where('flagged_count', '>', 0)->count(),
                'flags' => count($flags),
            ],
            'lastReport' => optional($reports->max('created_at'))->toDateTimeString(),
        ]);
    }
}
