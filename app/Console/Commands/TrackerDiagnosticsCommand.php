<?php

namespace App\Console\Commands;

use App\Support\TrackerHealthDiagnostics;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Read back the capture-health snapshots written by TrackerHealthDiagnostics —
 * a summary table by default, full JSON with --full, --user filter, --clear.
 */
class TrackerDiagnosticsCommand extends Command
{
    protected $signature = 'monitoring:tracker-diagnostics
        {--limit=20 : Max events to show, newest first}
        {--user= : Filter to a single user id}
        {--full : Dump the complete JSON context of each event}
        {--clear : Delete all captured snapshots}';

    protected $description = 'Show captured tracker-health events (why the silent-tracker watchdog alerted or skipped).';

    public function handle(): int
    {
        $dir = TrackerHealthDiagnostics::dir();

        if ($this->option('clear')) {
            File::deleteDirectory($dir);
            $this->info('Cleared all captured tracker-health diagnostics.');

            return self::SUCCESS;
        }

        if (! File::isDirectory($dir)) {
            $this->info("No tracker-health diagnostics captured yet ({$dir}).");

            return self::SUCCESS;
        }

        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;

        $events = collect(File::files($dir))
            ->sortByDesc(fn ($f) => $f->getFilename())
            ->map(fn ($f) => json_decode(File::get($f->getPathname()), true) ?: [])
            ->when($userId !== null, fn ($c) => $c->filter(fn ($e) => ($e['session']['user_id'] ?? null) === $userId))
            ->take((int) $this->option('limit'))
            ->values();

        if ($events->isEmpty()) {
            $this->info('No matching tracker-health diagnostics captured yet.');

            return self::SUCCESS;
        }

        if ($this->option('full')) {
            foreach ($events as $e) {
                $this->line(json_encode($e, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
                $this->line(str_repeat('─', 70));
            }

            return self::SUCCESS;
        }

        $this->table(
            ['captured', 'user', 'device', 'decision', 'clock', 'last capture', 'advanced(s)'],
            $events->map(function ($e) {
                $s = $e['session'] ?? [];
                $c = $e['capture'] ?? [];

                return [
                    $e['captured_at'] ?? '?',
                    $s['user_name'] ?? ('u'.($s['user_id'] ?? '?')),
                    $s['device_name'] ?? '?',
                    \Illuminate\Support\Str::limit($e['decision'] ?? '?', 30),
                    $e['clock']['current_state'] ?? '?',
                    $c['last_capture_at'] ?? 'never',
                    $s['seconds_advanced_since_probe'] ?? '?',
                ];
            })->all(),
        );
        $this->info($events->count().' event(s). --full for complete context; --clear to purge.');

        return self::SUCCESS;
    }
}
