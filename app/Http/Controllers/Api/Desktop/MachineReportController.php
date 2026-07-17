<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Models\MachineReport;
use App\Support\AutomationBlocklist;
use App\Support\Diagnostics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Receives endpoint-compliance inventory from the desktop agent (installed
 * extensions, programs, processes, network state), matches it against the
 * automation/VPN blocklist, and stores it for the Machine Compliance dashboard.
 * A newly-seen flagged item raises a Slack alert so a bidding-account risk is
 * caught the day it appears, not after Upwork bans the profile.
 */
class MachineReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'device_name' => ['nullable', 'string', 'max:120'],
            'app_version' => ['nullable', 'string', 'max:20'],
            'platform' => ['nullable', 'string', 'max:20'],
            'reports' => ['required', 'array', 'min:1', 'max:10'],
            'reports.*.kind' => ['required', Rule::in(['extensions', 'programs', 'processes', 'network', 'history'])],
            'reports.*.collected_at' => ['nullable', 'string', 'max:40'],
            'reports.*.items' => ['present', 'array', 'max:2000'],
        ]);

        $user = $request->user();
        $device = $data['device_name'] ?? null;
        $stored = 0;
        $totalFlagged = 0;

        foreach ($data['reports'] as $report) {
            $items = array_values(array_filter($report['items'], 'is_array'));
            $flagged = AutomationBlocklist::scan($items);

            MachineReport::create([
                'user_id' => $user->id,
                'device_name' => $device,
                'kind' => $report['kind'],
                'collected_at' => isset($report['collected_at']) ? \Illuminate\Support\Carbon::parse($report['collected_at']) : now(),
                'items' => $items,
                'flagged' => $flagged ?: null,
                'item_count' => count($items),
                'flagged_count' => count($flagged),
                'app_version' => $data['app_version'] ?? null,
                'platform' => $data['platform'] ?? null,
            ]);
            $stored++;

            if ($flagged) {
                $totalFlagged += count($flagged);
                $this->alertOnNewFlags($user->name, $device, $report['kind'], $flagged);
            }
        }

        return response()->json(['stored' => $stored, 'flagged' => $totalFlagged]);
    }

    /**
     * Slack-alert a flagged item the first time it's seen for this machine
     * (deduped for a day) — installing a refresh tool / scraper / VPN / jiggler
     * is the exact thing that gets a profile banned.
     */
    private function alertOnNewFlags(string $userName, ?string $device, string $kind, array $flagged): void
    {
        foreach ($flagged as $f) {
            $label = $f['name'] ?? $f['title'] ?? $f['process'] ?? $f['path'] ?? 'unknown';
            $key = 'machineflag:'.md5(($device ?? '').'|'.$kind.'|'.$label);
            if (Cache::has($key)) {
                continue;
            }
            Cache::put($key, true, now()->addDay());

            Diagnostics::capture('monitoring', [
                'level' => $f['severity'] === 'critical' ? 'error' : 'warn',
                'summary' => sprintf('[%s] %s on %s (%s) — %s / %s',
                    strtoupper($f['severity']), $label, $device ?: '?', $userName, $kind, $f['rule']),
                'user' => $userName, 'device' => $device, 'kind' => $kind,
                'item' => $label, 'rule' => $f['rule'], 'severity' => $f['severity'],
            ]);

            try {
                $channel = config('services.attendance.tracker_health_channel') ?: config('services.attendance.clockin_channel');
                if ($channel) {
                    app(\App\Services\SlackBotService::class)->postToChannel($channel, sprintf(
                        ":rotating_light: Compliance: *%s* has *%s* installed (%s) on %s — %s. This can get an Upwork profile flagged; review + remove.",
                        $userName, $label, $f['rule'], $device ?: 'unknown PC', ucfirst($kind)
                    ));
                }
            } catch (\Throwable $e) {
                Log::warning('Machine-flag Slack alert failed', ['message' => $e->getMessage()]);
            }
        }
    }
}
