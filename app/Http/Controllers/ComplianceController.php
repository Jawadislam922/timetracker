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
                    'profiles' => $g->pluck('browser_profile')->filter()->unique()->count(),
                    // ONE row per (person, machine), with every affected browser
                    // profile listed on it. Flags stay per-profile in the database —
                    // a fresh install in a new profile still alerts — but four rows
                    // reading "Jawad / Jawad / Chrome" that differ only in the profile
                    // column is unreadable once a tool is on 20 machines.
                    'occurrences' => $g->groupBy(fn ($f) => $f->user_id.'|'.$f->device_name)
                        ->map(function ($rows) {
                            $first = $rows->first();
                            // Every flag id behind this row: Acknowledge/Ignore acts on
                            // all of them at once, so one click clears the tool for
                            // this person instead of four.
                            $ids = $rows->pluck('id')->values()->all();
                            $profiles = $rows->pluck('browser_profile')->filter()->unique()->sort()->values()->all();

                            return [
                                'id' => $first->id,
                                'ids' => $ids,
                                'user' => $first->user?->name,
                                'device' => $first->device_name,
                                'profiles' => $profiles,
                                // True when at least one flag came from an agent older
                                // than 0.4.8, which cannot report a profile at all.
                                'unknown_profiles' => $rows->whereNull('browser_profile')->count(),
                                // A row is only "acknowledged" once every profile is.
                                'status' => $rows->contains(fn ($f) => $f->status === 'open') ? 'open' : 'acknowledged',
                                'first_seen' => optional($rows->min('first_seen_at'))->toDateTimeString(),
                                'last_seen' => optional($rows->max('last_seen_at'))->toDateTimeString(),
                                'app_version' => $first->app_version,
                            ];
                        })->sortBy('user')->values()->all(),
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
            'employees' => fn () => Cache::remember($invKey.':emp3', now()->addMinutes(10),
                fn () => $this->employeeInventory($getInvReports(), $flagOf)),
            'extensions' => fn () => Cache::remember($invKey.':ext3', now()->addMinutes(10),
                fn () => $this->extensionInventory($getInvReports(), $flagOf)),
            'summary' => [
                'machines' => $machines->count(),
                'open_alerts' => $flags->where('alert', true)->where('status', 'open')->count(),
                'watch' => $flags->where('alert', false)->count(),
                // Agents older than this could not report browser extensions at all,
                // so an empty extension list from them must not read as "clean".
                'min_agent' => $minAgent = (string) config('desktop.min_agent_version', '0.4.6'),
                'outdated_agents' => $machines
                    ->filter(fn ($m) => ! $m['app_version'] || version_compare((string) $m['app_version'], $minAgent, '<'))
                    ->count(),
            ],
            'lastReport' => optional($machineRows->max('created_at'))->toDateTimeString(),
        ]);
    }

    /**
     * Acknowledge (seen, stay quiet), Ignore (never alert here again), or reopen.
     *
     * Accepts optional `ids` so ONE click can clear a tool across every browser
     * profile it was found in on that person's machine. Flags are stored per
     * profile — that is what makes a reinstall in a different profile alert again —
     * but nobody wants to press Acknowledge four times for one scraper.
     */
    public function updateFlag(Request $request, MachineFlag $flag): RedirectResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:open,acknowledged,ignored'],
            'ids' => ['sometimes', 'array', 'max:200'],
            'ids.*' => ['integer'],
        ]);

        // Scope any bulk action to the SAME person, machine and tool as the flag in
        // the URL, so a crafted id list can never touch another machine's ledger.
        $targets = collect([$flag]);
        if (! empty($data['ids'])) {
            $targets = MachineFlag::whereIn('id', $data['ids'])
                ->where('user_id', $flag->user_id)
                ->where('device_name', $flag->device_name)
                ->where('rule', $flag->rule)
                ->where('label', $flag->label)
                ->get();
            if ($targets->isEmpty()) {
                $targets = collect([$flag]);
            }
        }

        foreach ($targets as $target) {
            $target->status = $data['status'];
            if ($data['status'] === 'acknowledged') {
                $target->acknowledged_by = $request->user()->id;
                $target->acknowledged_at = now();
            }
            if ($data['status'] === 'open') {
                $target->acknowledged_by = null;
                $target->acknowledged_at = null;
                $target->resolved_at = null;
            }
            $target->save();
        }

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
                // Key by kind+name+DEVICE+PROFILE. The profile has to be in the key:
                // people run 20-30 Chrome profiles per PC (often one per Upwork
                // account), so collapsing on name alone hides the fact that the same
                // scraper sits in three of them — and hides WHICH three, which is the
                // only part anyone can act on. Device is in the key too, because a
                // colleague signing into someone else's PC is a real case here.
                $profile = trim((string) ($it['browser_profile'] ?? ''));
                $key = $r->kind.'|'.mb_strtolower($name).'|'.$r->device_name.'|'.$profile;
                if (! isset($byUser[$uid]['items'][$key])) {
                    $hit = $flagOf($it, $r->kind);
                    $byUser[$uid]['items'][$key] = [
                        'name' => $name,
                        'kind' => $r->kind,
                        'browser' => $it['browser'] ?? null,
                        'browser_profile' => $profile !== '' ? $profile : null,
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
                // Browser profiles this person has, each with the extensions living
                // in it — the "under Jawad, which profile has which extension" view.
                'profiles' => self::groupByProfile($items),
            ];
        })->values()->all();

        // People with flagged extensions first, then alphabetical for easy scanning.
        usort($rows, fn ($a, $b) => ($b['flagged'] <=> $a['flagged'])
            ?: strcasecmp($a['user'] ?? '', $b['user'] ?? ''));

        return $rows;
    }

    /**
     * Group one person's inventory into (device, browser profile) buckets.
     *
     * A bucket with `profile === null` means the agent on that machine predates
     * 0.4.8 and cannot report profiles yet — presented as "profile unknown", never
     * as "no profile", so a missing attribution is never mistaken for an all-clear.
     *
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $items
     * @return array<int, array<string, mixed>>
     */
    private static function groupByProfile($items): array
    {
        $buckets = [];

        foreach ($items->where('kind', 'extensions') as $it) {
            $key = ($it['device'] ?? '').'|'.($it['browser'] ?? '').'|'.($it['browser_profile'] ?? '');
            if (! isset($buckets[$key])) {
                $buckets[$key] = [
                    'device' => $it['device'] ?? null,
                    'browser' => $it['browser'] ?? null,
                    'profile' => $it['browser_profile'] ?? null,
                    'extensions' => [],
                ];
            }
            $buckets[$key]['extensions'][] = $it;
        }

        $rows = [];
        foreach ($buckets as $b) {
            $exts = collect($b['extensions'])->sortByDesc(fn ($x) => $x['flagged'] ? 1 : 0)->values();
            $b['extensions'] = $exts->all();
            $b['count'] = $exts->count();
            $b['flagged'] = $exts->where('flagged', true)->count();
            $rows[] = $b;
        }

        // Profiles carrying a flagged tool first — that is the queue to work through.
        usort($rows, fn ($a, $b) => ($b['flagged'] <=> $a['flagged'])
            ?: strcasecmp((string) $a['profile'], (string) $b['profile']));

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
                    // Whose login, on which PC, in which browser profile — the three
                    // things needed to actually go and remove it. Matters most when
                    // someone signs into a colleague's machine and installs something.
                    'profile' => (($p = trim((string) ($it['browser_profile'] ?? ''))) !== '') ? $p : null,
                    'enabled' => $it['enabled'] ?? null,
                ];
            }
        }

        return collect($map)->map(function ($e) {
            $users = collect($e['users']);
            $e['people'] = $users->pluck('user')->filter()->unique()->count();
            $e['machines'] = $users->pluck('device')->filter()->unique()->count();
            $e['profiles'] = $users->pluck('profile')->filter()->unique()->count();
            // ONE row per (person, machine) with the affected profiles listed on it.
            // Four near-identical rows differing only in the profile column is what
            // made this page unreadable; the profile names still all appear.
            $e['users'] = $users->groupBy(fn ($u) => $u['user'].'|'.$u['device'])
                ->map(fn ($g) => [
                    'user' => $g->first()['user'],
                    'device' => $g->first()['device'],
                    'browser' => $g->pluck('browser')->filter()->unique()->implode(', '),
                    'profiles' => $g->pluck('profile')->filter()->unique()->sort()->values()->all(),
                    'unknown_profiles' => $g->whereNull('profile')->count(),
                ])->sortBy('user')->values()->all();

            return $e;
        })
            ->sortByDesc(fn ($e) => ($e['flagged'] ? 1_000_000 : 0) + $e['people'])
            ->values()
            ->all();
    }
}
