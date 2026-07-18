<?php

namespace App\Http\Controllers;

use App\Models\MachineFlag;
use App\Models\MachineReport;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Machine Compliance — a tool-first view of what's installed on every PC.
 *
 * The flagged tools come from the durable machine_flags ledger (open +
 * acknowledged), grouped by tool so "Instant Data Scraper is on 3 machines" is
 * one row you expand to the names — no walking desk to desk. Only the
 * Upwork-banning categories are alarming; VPNs / automation frameworks are
 * shown as "watch". Managers Acknowledge or Ignore a flag from here.
 */
class ComplianceController extends Controller
{
    private const SEV_WEIGHT = ['critical' => 3, 'high' => 2, 'medium' => 1, 'low' => 0];

    public function index(Request $request): Response
    {
        // ---- Flagged tools, from the ledger, grouped by tool ------------------
        $flags = MachineFlag::with('user:id,name')
            ->whereIn('status', ['open', 'acknowledged'])
            ->get();

        $tools = $flags
            ->groupBy(fn ($f) => $f->rule.'|'.mb_strtolower($f->label))
            ->map(function ($g) {
                $first = $g->first();

                return [
                    'name' => $first->label,
                    'rule' => $first->rule,
                    'severity' => $first->severity,
                    'alert' => (bool) $first->alert,
                    'category' => $first->alert ? 'ban' : 'watch',
                    'people' => $g->pluck('user_id')->unique()->count(),
                    'machines' => $g->pluck('device_name')->unique()->count(),
                    'occurrences' => $g->sortBy('user_id')->map(fn ($f) => [
                        'id' => $f->id,
                        'user' => $f->user?->name,
                        'device' => $f->device_name,
                        'status' => $f->status,
                        'first_seen' => optional($f->first_seen_at)->toDateTimeString(),
                        'last_seen' => optional($f->last_seen_at)->toDateTimeString(),
                        'app_version' => $f->app_version,
                    ])->values()->all(),
                ];
            })
            ->sortByDesc(fn ($t) => ($t['alert'] ? 1_000_000 : 0)
                + (self::SEV_WEIGHT[$t['severity']] ?? 0) * 1_000
                + $t['people'])
            ->values();

        // Open banning flags per (user, device) → the machine's "needs action" badge.
        $openByMachine = $flags->where('alert', true)->where('status', 'open')
            ->groupBy(fn ($f) => $f->device_name.'|'.$f->user_id)
            ->map->count();

        // ---- Machines, from the latest daily snapshots ------------------------
        // Metadata only — never load the heavy items/flagged JSON here.
        $latestIds = MachineReport::selectRaw('MAX(id) as id')
            ->groupBy('user_id', 'device_name', 'kind')
            ->pluck('id');
        $machineRows = MachineReport::with('user:id,name')
            ->whereIn('id', $latestIds)
            ->get(['id', 'user_id', 'device_name', 'kind', 'item_count', 'app_version', 'collected_at', 'created_at']);

        $machines = $machineRows->groupBy(fn ($r) => $r->device_name.'|'.$r->user_id)->map(function ($g) use ($openByMachine) {
            $first = $g->first();
            $key = $first->device_name.'|'.$first->user_id;

            return [
                'device' => $first->device_name ?: 'unknown',
                'device_name' => $first->device_name,
                'user' => $first->user?->name,
                'user_id' => $first->user_id,
                'app_version' => $first->app_version,
                'last_seen' => optional($g->max('collected_at') ?? $g->max('created_at'))->toDateTimeString(),
                'counts' => $g->mapWithKeys(fn ($r) => [$r->kind => (int) $r->item_count])->all(),
                'open_alerts' => (int) ($openByMachine[$key] ?? 0),
            ];
        })->sortByDesc('open_alerts')->values();

        // Heavy extension inventory is loaded once and shared, and only computed
        // on a FULL page visit — Acknowledge/Ignore partial reloads (only:[tools,
        // summary,machines]) skip these closures entirely, so the buttons are snappy.
        // Extensions + programs: together these answer "what does this person have
        // installed". Processes/network are deliberately excluded here — they are
        // huge and transient, and are already covered by the flagged-tools list.
        $invReports = null;
        $getInvReports = function () use (&$invReports, $latestIds) {
            return $invReports ??= MachineReport::with('user:id,name')
                ->whereIn('id', $latestIds)->whereIn('kind', ['extensions', 'programs'])->get();
        };
        $scanCache = [];
        $flagOf = function ($it, $kind = 'extensions') use (&$scanCache) {
            $name = mb_strtolower(trim((string) ($it['name'] ?? $it['process'] ?? $it['adapter'] ?? '')));
            $k = $kind.'|'.$name;

            return $scanCache[$k] ??= (\App\Support\AutomationBlocklist::scan([$it], $kind)[0] ?? null);
        };

        // Cache the heavy inventories briefly, keyed on the report set so a new
        // daily snapshot (or a delete) busts it. Slow-changing data — the ledger
        // (tools/summary/machines) is never cached, so Acknowledge stays instant.
        $invKey = 'compliance-inv:'.$latestIds->max().':'.$latestIds->count();

        return Inertia::render('Monitoring/Compliance', [
            'tools' => $tools,
            'machines' => $machines,
            'employees' => fn () => Cache::remember($invKey.':emp2', now()->addMinutes(10),
                fn () => $this->employeeInventory($getInvReports(), $flagOf)),
            'extensions' => fn () => Cache::remember($invKey.':ext2', now()->addMinutes(10),
                fn () => $this->extensionInventory($getInvReports(), $flagOf)),
            'summary' => [
                'machines' => $machines->count(),
                'open_alerts' => $flags->where('alert', true)->where('status', 'open')->count(),
                'watch' => $flags->where('alert', false)->count(),
            ],
            'lastReport' => optional($machineRows->max('created_at'))->toDateTimeString(),
        ]);
    }

    /** Acknowledge (seen, stay quiet), Ignore (never alert here again), or reopen a flag. */
    public function updateFlag(Request $request, MachineFlag $flag): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:open,acknowledged,ignored'],
        ]);

        $flag->status = $data['status'];
        if ($data['status'] === 'acknowledged') {
            $flag->acknowledged_by = $request->user()->id;
            $flag->acknowledged_at = now();
        }
        if ($data['status'] === 'open') {
            $flag->acknowledged_by = null;
            $flag->acknowledged_at = null;
            $flag->resolved_at = null;
        }
        $flag->save();

        return back();
    }

    /** Delete a machine's compliance history (snapshots + ledger) for review cleanup. */
    public function destroyMachine(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $scope = fn ($q) => $q->where('user_id', $data['user_id'])
            ->where('device_name', $data['device_name'] ?? null);

        $scope(MachineReport::query())->delete();
        $scope(MachineFlag::query())->delete();

        return back();
    }

    /**
     * One row per employee → every ENABLED extension they run across their
     * machines. With 100-200 extensions team-wide, browsing by person ("what is
     * Ali running?") beats clicking each tool one by one. Flagged extensions and
     * people who have them sort first.
     *
     * @param  \Illuminate\Support\Collection<int, MachineReport>  $reports
     */
    private function employeeInventory($reports, callable $flagOf): array
    {
        $byUser = [];

        foreach ($reports as $r) {
            $uid = $r->user_id;
            if (! isset($byUser[$uid])) {
                $byUser[$uid] = ['user_id' => $uid, 'user' => $r->user?->name, 'devices' => [], 'items' => []];
            }
            if ($r->device_name) {
                $byUser[$uid]['devices'][$r->device_name] = true;
            }
            foreach ((array) $r->items as $it) {
                $name = trim((string) ($it['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                // Key by kind+name so an extension and a program of the same name
                // both show, and the same tool on two machines shows once.
                $key = $r->kind.'|'.mb_strtolower($name);
                if (! isset($byUser[$uid]['items'][$key])) {
                    $hit = $flagOf($it, $r->kind);
                    $byUser[$uid]['items'][$key] = [
                        'name' => $name,
                        'kind' => $r->kind,
                        'browser' => $it['browser'] ?? null,
                        'publisher' => $it['publisher'] ?? null,
                        'device' => $r->device_name,
                        'flagged' => (bool) $hit,
                        'rule' => $hit['rule'] ?? null,
                        'severity' => $hit['severity'] ?? null,
                    ];
                }
            }
        }

        $rows = collect($byUser)->map(function ($e) {
            $items = collect($e['items'])
                ->sortByDesc(fn ($x) => ($x['flagged'] ? 1 : 0))
                ->values();

            return [
                'user_id' => $e['user_id'],
                'user' => $e['user'],
                'machines' => array_keys($e['devices']),
                'count' => $items->count(),
                'extension_count' => $items->where('kind', 'extensions')->count(),
                'program_count' => $items->where('kind', 'programs')->count(),
                'flagged' => $items->where('flagged', true)->count(),
                'extensions' => $items->all(),
            ];
        })->values()->all();

        // People with flagged extensions first, then alphabetical for easy scanning.
        usort($rows, fn ($a, $b) => ($b['flagged'] <=> $a['flagged'])
            ?: strcasecmp($a['user'] ?? '', $b['user'] ?? ''));

        return $rows;
    }

    /**
     * Every distinct ENABLED browser extension across the team, with who has it —
     * so "Instant Data Scraper is on 3 machines" is one click to the names.
     * Flagged (blocklisted) extensions sort first.
     *
     * @param  \Illuminate\Support\Collection<int, MachineReport>  $reports
     */
    private function extensionInventory($reports, callable $flagOf): array
    {
        $map = [];

        foreach ($reports->where('kind', 'extensions') as $r) {
            foreach ((array) $r->items as $it) {
                $name = trim((string) ($it['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $key = mb_strtolower($name);
                if (! isset($map[$key])) {
                    $hit = $flagOf($it);
                    $map[$key] = [
                        'name' => $name,
                        'flagged' => (bool) $hit,
                        'rule' => $hit['rule'] ?? null,
                        'severity' => $hit['severity'] ?? null,
                        'users' => [],
                    ];
                }
                $map[$key]['users'][] = [
                    'user' => $r->user?->name,
                    'device' => $r->device_name,
                    'browser' => $it['browser'] ?? null,
                    'enabled' => $it['enabled'] ?? null,
                ];
            }
        }

        return collect($map)->map(function ($e) {
            $users = collect($e['users']);
            $e['people'] = $users->pluck('user')->filter()->unique()->count();
            $e['machines'] = $users->pluck('device')->filter()->unique()->count();
            $e['users'] = $users->unique(fn ($u) => $u['user'].'|'.$u['device'])->values()->all();

            return $e;
        })
            ->sortByDesc(fn ($e) => ($e['flagged'] ? 1_000_000 : 0) + $e['people'])
            ->values()
            ->all();
    }
}
