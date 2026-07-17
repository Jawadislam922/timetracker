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
        $newFlags = [];   // NEW flagged items across this whole upload → one message

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

            foreach ($flagged as $f) {
                $label = $f['name'] ?? $f['title'] ?? $f['process'] ?? $f['path'] ?? 'unknown';
                // Diagnostics record for every hit (the dashboard/audit trail).
                Diagnostics::capture('monitoring', [
                    'level' => ($f['severity'] ?? 'warn') === 'critical' ? 'error' : 'warn',
                    'summary' => sprintf('[%s] %s on %s (%s) — %s / %s',
                        strtoupper($f['severity'] ?? 'warn'), $label, $device ?: '?', $user->name, $report['kind'], $f['rule'] ?? '?'),
                    'user' => $user->name, 'device' => $device, 'kind' => $report['kind'],
                    'item' => $label, 'rule' => $f['rule'] ?? null, 'severity' => $f['severity'] ?? 'warn',
                ]);

                // Only NEW (per machine+item, once a day) items go into the Slack digest.
                $key = 'machineflag:'.md5(($device ?? '').'|'.$label);
                if (! Cache::has($key)) {
                    Cache::put($key, true, now()->addDay());
                    $newFlags[] = ['item' => $label, 'kind' => $report['kind'], 'rule' => $f['rule'] ?? '?', 'severity' => $f['severity'] ?? 'warn'];
                }
            }
        }

        // ONE consolidated Slack message per person+machine per upload.
        if ($newFlags) {
            $this->announce($user->name, $device, $newFlags);
        }

        return response()->json(['stored' => $stored, 'flagged' => count($newFlags)]);
    }

    /** One tidy message per person listing every newly-found flagged item. */
    private function announce(string $userName, ?string $device, array $newFlags): void
    {
        try {
            $channel = config('services.attendance.compliance_channel')
                ?: config('services.attendance.tracker_health_channel')
                ?: config('services.attendance.clockin_channel');
            if (! $channel) {
                return;
            }

            $critical = collect($newFlags)->contains(fn ($f) => $f['severity'] === 'critical');
            $lines = collect($newFlags)->map(fn ($f) => sprintf('  • *%s*  _(%s · %s)_', $f['item'], $f['rule'], $f['kind']))->implode("\n");

            $message = sprintf(
                "%s *Compliance — %s* on `%s`\nFound %d flagged item%s that can get an Upwork profile flagged — review + remove:\n%s",
                $critical ? ':rotating_light:' : ':warning:',
                $userName,
                $device ?: 'unknown PC',
                count($newFlags),
                count($newFlags) === 1 ? '' : 's',
                $lines,
            );

            app(\App\Services\SlackBotService::class)->postToChannel($channel, $message);
        } catch (\Throwable $e) {
            Log::warning('Compliance Slack alert failed', ['message' => $e->getMessage()]);
        }
    }
}
