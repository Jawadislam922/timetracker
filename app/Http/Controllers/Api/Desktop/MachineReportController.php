<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Models\MachineFlag;
use App\Models\MachineReport;
use App\Support\AutomationBlocklist;
use App\Support\Diagnostics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Receives endpoint-compliance inventory from the desktop agent (installed
 * extensions, programs, processes, network state), matches it against the
 * automation blocklist, keeps one daily snapshot per machine, and maintains a
 * durable ledger of flagged tools (machine_flags).
 *
 * A tool alerts to Slack EXACTLY ONCE — when it first appears (a real install)
 * — and only for the Upwork-banning categories. It stays quiet while present,
 * auto-resolves when it disappears, and re-alerts only if it comes back. VPNs
 * and automation frameworks are recorded for review but never ping a channel.
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
        $newFlags = [];   // NEW banning-tool installs across this upload → one message

        foreach ($data['reports'] as $report) {
            $kind = $report['kind'];
            $items = array_values(array_filter($report['items'], 'is_array'));
            // The agent already sends only ENABLED extensions (owner's policy), so
            // trust it and scan everything received. Filtering on an `enabled` flag
            // here silently dropped 100% of extensions from older agents, which
            // reported enabled=false for every one.
            $hits = AutomationBlocklist::scan($items, $kind);

            $collectedAt = isset($report['collected_at'])
                ? rescue(fn () => Carbon::parse($report['collected_at']), now(), false)
                : now();
            if (! $collectedAt instanceof Carbon) {
                $collectedAt = now();
            }

            // Keep one snapshot per machine/kind/day — a browsable, deletable
            // daily record without unbounded hourly bloat.
            MachineReport::where('user_id', $user->id)
                ->where('device_name', $device)
                ->where('kind', $kind)
                ->whereDate('collected_at', $collectedAt->toDateString())
                ->delete();

            MachineReport::create([
                'user_id' => $user->id,
                'device_name' => $device,
                'kind' => $kind,
                'collected_at' => $collectedAt,
                'items' => $items,
                'flagged' => $hits ?: null,
                'item_count' => count($items),
                'flagged_count' => count($hits),
                'app_version' => $data['app_version'] ?? null,
                'platform' => $data['platform'] ?? null,
            ]);
            $stored++;

            $newFlags = array_merge($newFlags, $this->reconcileFlags($user, $device, $kind, $hits, $data));
        }

        // ONE consolidated Slack message per person+machine per upload.
        if ($newFlags) {
            $this->announce($user->name, $device, $newFlags);
        }

        return response()->json(['stored' => $stored, 'flagged' => count($newFlags)]);
    }

    /**
     * Sync the durable ledger for one report kind and return the banning tools
     * that newly appeared (a genuine install/reinstall) so they alert once.
     *
     * @param  array<int, array<string, mixed>>  $hits
     * @return array<int, array<string, string>>
     */
    private function reconcileFlags($user, ?string $device, string $kind, array $hits, array $data): array
    {
        $newFlags = [];
        $presentSignatures = [];

        foreach ($hits as $f) {
            $signature = $this->signature($kind, $f);
            $presentSignatures[] = $signature;
            $label = $this->label($f);

            $flag = MachineFlag::firstOrNew([
                'user_id' => $user->id,
                'device_name' => $device,
                'signature' => $signature,
            ]);

            // "New" = never seen, or seen before and since resolved (the tool
            // disappeared and came back). Ignored flags stay silent forever.
            $reappeared = $flag->exists && $flag->status === 'resolved';
            $isNew = (! $flag->exists || $reappeared) && $flag->status !== 'ignored';

            if ($isNew) {
                $flag->status = 'open';
                $flag->first_seen_at = $flag->first_seen_at ?? now();
                $flag->alerted_at = now();
                $flag->resolved_at = null;
            }

            $flag->kind = $kind;
            $flag->rule = $f['rule'];
            $flag->severity = $f['severity'];
            $flag->alert = (bool) ($f['alert'] ?? false);
            $flag->label = $label;
            $flag->browser_profile = self::profileOf($f) ?: null;
            $flag->app_version = $data['app_version'] ?? $flag->app_version;
            $flag->platform = $data['platform'] ?? $flag->platform;
            $flag->last_seen_at = now();
            $flag->save();

            // Audit-trail diagnostics for every hit (VPNs included).
            Diagnostics::capture('monitoring', [
                'level' => ($f['severity'] ?? 'warn') === 'critical' ? 'error' : 'warn',
                'summary' => sprintf('[%s] %s on %s (%s) — %s / %s',
                    strtoupper($f['severity'] ?? 'warn'), $label, $device ?: '?', $user->name, $kind, $f['rule'] ?? '?'),
                'user' => $user->name, 'device' => $device, 'kind' => $kind,
                'item' => $label, 'rule' => $f['rule'] ?? null, 'severity' => $f['severity'] ?? 'warn',
            ]);

            // Slack only for the Upwork-banning categories, and only on a real
            // open/reopen transition.
            if ($isNew && $flag->alert) {
                $newFlags[] = [
                    'item' => $label, 'kind' => $kind, 'rule' => $f['rule'] ?? '?',
                    'severity' => $f['severity'] ?? 'warn',
                    'browser_profile' => $flag->browser_profile,
                ];
            }
        }

        // Auto-resolve tools that used to be flagged on this kind but are gone
        // now. Leave 'ignored' rows untouched (they're a per-machine allowlist).
        MachineFlag::where('user_id', $user->id)
            ->where('device_name', $device)
            ->where('kind', $kind)
            ->whereIn('status', ['open', 'acknowledged'])
            ->when($presentSignatures, fn ($q) => $q->whereNotIn('signature', $presentSignatures))
            ->update(['status' => 'resolved', 'resolved_at' => now()]);

        return $newFlags;
    }

    /**
     * Stable per-tool identity so the same install maps to the same ledger row.
     *
     * For extensions the identity includes the BROWSER PROFILE, so the same tool
     * in two Chrome profiles is two findings rather than one. That is deliberate:
     * a scraper in "Upwork Faryal" and a scraper in someone's personal profile
     * carry completely different Upwork ban risk, and each has to be cleared on
     * its own. Older agents send no profile and collapse to one row, as before.
     */
    private function signature(string $kind, array $item): string
    {
        $identity = match ($kind) {
            'extensions' => ($item['browser'] ?? '').'|'.self::profileOf($item).'|'.($item['id'] ?? $item['name'] ?? ''),
            'programs' => ($item['name'] ?? '').'|'.($item['publisher'] ?? ''),
            'processes' => $item['process'] ?? $item['path'] ?? '',
            'network' => ($item['adapter'] ?? '').'|'.($item['description'] ?? ''),
            default => $item['name'] ?? $item['title'] ?? '',
        };

        return md5(($item['rule'] ?? '').'|'.mb_strtolower(trim($identity)));
    }

    /** Human-readable name — network items carry adapter/description, not name. */
    private function label(array $f): string
    {
        return $f['name'] ?? $f['title'] ?? $f['process'] ?? $f['adapter'] ?? $f['description'] ?? $f['path'] ?? 'unknown';
    }

    /**
     * The browser profile an extension lives in, normalised for storage and for
     * the signature. Empty string for every non-extension kind and for agents
     * older than 0.4.8 — which is why it must never be presented as "no profile"
     * in the UI (it means "this agent cannot tell us yet").
     *
     * Re-sanitised here rather than trusting the client: the label is typed by an
     * employee into Chrome and reaches us as free text.
     */
    private static function profileOf(array $item): string
    {
        $raw = $item['browser_profile'] ?? '';
        if (! is_string($raw)) {
            return '';
        }

        // Angle brackets become spaces rather than vanishing, so stripping them
        // cannot run two words together into something misleading.
        return mb_substr(trim(preg_replace('/\s+/u', ' ', str_replace(['<', '>'], ' ', $raw))), 0, 60);
    }

    /** One tidy message per person listing every newly-installed banning tool. */
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
            // Name the browser profile when we know it: "which Upwork account is at
            // risk" is the actionable part, not "which PC".
            $lines = collect($newFlags)->map(fn ($f) => sprintf(
                '  • *%s*  _(%s · %s)_%s',
                $f['item'],
                $f['rule'],
                $f['kind'],
                ! empty($f['browser_profile']) ? sprintf('  → profile *%s*', $f['browser_profile']) : '',
            ))->implode("\n");

            $message = sprintf(
                "%s *Compliance — %s* on `%s`\nNewly installed %d tool%s that can get an Upwork profile flagged — review + remove:\n%s",
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
