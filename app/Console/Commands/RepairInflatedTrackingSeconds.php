<?php

namespace App\Console\Commands;

use App\Models\TrackingSession;
use App\Services\TrackingSessionService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * One-off repair for the desktop double-timer / double-start bug: a session's
 * total_seconds can never exceed its real elapsed wall-clock, so any stored
 * value above elapsed is impossible. Clamp those down to elapsed. Dry run by
 * default; --apply backs up the affected rows first (fully reversible) and
 * re-syncs the work-diary hours that derive from them.
 */
class RepairInflatedTrackingSeconds extends Command
{
    protected $signature = 'tracking:repair-inflated
        {--apply : Actually update rows (default is a dry run)}
        {--grace=2 : Seconds of slack over elapsed before a row counts as inflated}';

    protected $description = 'Clamp tracking_sessions whose total_seconds exceed their real elapsed wall-clock down to elapsed (backs up first).';

    public function handle(TrackingSessionService $sessions): int
    {
        $grace = (int) $this->option('grace');
        $apply = (bool) $this->option('apply');

        $affected = TrackingSession::query()
            ->whereNotNull('started_at')
            ->whereNotNull('stopped_at')
            ->get()
            ->filter(function (TrackingSession $s) use ($grace) {
                $elapsed = max(0, $s->stopped_at->getTimestamp() - $s->started_at->getTimestamp());
                return (int) $s->total_seconds > $elapsed + $grace;
            })
            ->values();

        if ($affected->isEmpty()) {
            $this->info('No inflated sessions found. Nothing to repair.');
            return self::SUCCESS;
        }

        $rows = $affected->map(function (TrackingSession $s) {
            $elapsed = max(0, $s->stopped_at->getTimestamp() - $s->started_at->getTimestamp());
            return [
                'id' => $s->id,
                'user_id' => $s->user_id,
                'started_at' => (string) $s->started_at,
                'stopped_at' => (string) $s->stopped_at,
                'total_seconds_old' => (int) $s->total_seconds,
                'total_seconds_new' => $elapsed,
                'removed_seconds' => (int) $s->total_seconds - $elapsed,
            ];
        });

        $this->table(
            ['id', 'user', 'old (s)', 'new (s)', 'removed (s)'],
            $rows->map(fn ($r) => [$r['id'], $r['user_id'], $r['total_seconds_old'], $r['total_seconds_new'], $r['removed_seconds']])->all(),
        );
        $this->warn(sprintf('%d inflated sessions across %d users — %.1f phantom hours total.',
            $rows->count(), $rows->pluck('user_id')->unique()->count(), $rows->sum('removed_seconds') / 3600));

        if (! $apply) {
            $this->info('Dry run only. Re-run with --apply to back up + repair.');
            return self::SUCCESS;
        }

        $backup = storage_path('app/repairs/inflated-tracking-'.now()->format('Ymd-His').'.json');
        File::ensureDirectoryExists(dirname($backup));
        File::put($backup, $rows->toJson(JSON_PRETTY_PRINT));
        $this->info('Backup written: '.$backup);

        foreach ($rows as $r) {
            TrackingSession::where('id', $r['id'])->update(['total_seconds' => $r['total_seconds_new']]);
            try {
                $sessions->syncWorkHour(TrackingSession::find($r['id']));
            } catch (\Throwable $e) {
                $this->warn("  work-hour re-sync failed for session {$r['id']}: {$e->getMessage()}");
            }
        }

        $this->info(sprintf('Repaired %d sessions and re-synced their work-diary hours.', $rows->count()));
        return self::SUCCESS;
    }
}
