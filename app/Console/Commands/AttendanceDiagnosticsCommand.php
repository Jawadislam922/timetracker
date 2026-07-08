<?php

namespace App\Console\Commands;

use App\Support\AttendanceDiagnostics;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

/**
 * Read back the attendance action_date mismatch snapshots captured by
 * AttendanceDiagnostics — a summary table by default, full JSON with --full,
 * and --clear to purge once a bug is understood.
 */
class AttendanceDiagnosticsCommand extends Command
{
    protected $signature = 'attendance:diagnostics
        {--limit=20 : Max events to show, newest first}
        {--user= : Filter to a single user id}
        {--full : Dump the complete JSON context of each event}
        {--clear : Delete all captured snapshots}';

    protected $description = 'Show captured attendance action_date mismatch diagnostics (request payload, call path, clock state).';

    public function handle(): int
    {
        $dir = AttendanceDiagnostics::dir();

        if ($this->option('clear')) {
            File::deleteDirectory($dir);
            $this->info('Cleared all captured diagnostics.');

            return self::SUCCESS;
        }

        if (! File::isDirectory($dir)) {
            $this->info("No diagnostics captured yet ({$dir}).");

            return self::SUCCESS;
        }

        $userId = $this->option('user') !== null ? (int) $this->option('user') : null;

        $events = collect(File::files($dir))
            ->sortByDesc(fn ($f) => $f->getFilename())
            ->map(fn ($f) => ['path' => $f->getPathname(), 'data' => json_decode(File::get($f->getPathname()), true) ?: []])
            ->when($userId !== null, fn ($c) => $c->filter(fn ($e) => ($e['data']['entry']['user_id'] ?? null) === $userId))
            ->take((int) $this->option('limit'))
            ->values();

        if ($events->isEmpty()) {
            $this->info('No matching diagnostics captured yet.');

            return self::SUCCESS;
        }

        if ($this->option('full')) {
            foreach ($events as $e) {
                $this->line(json_encode($e['data'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
                $this->line(str_repeat('─', 70));
            }

            return self::SUCCESS;
        }

        $this->table(
            ['captured', 'user', 'type', 'stored →', 'correct', 'notes', 'via'],
            $events->map(function ($e) {
                $entry = $e['data']['entry'] ?? [];
                $req = $e['data']['request'] ?? [];

                return [
                    $e['data']['captured_at'] ?? '?',
                    $entry['user_name'] ?? ('u'.($entry['user_id'] ?? '?')),
                    $entry['action_type'] ?? '?',
                    $entry['stored_action_date'] ?? '?',
                    $entry['correct_action_date'] ?? '?',
                    \Illuminate\Support\Str::limit($entry['notes'] ?? '-', 18),
                    $req['route_action'] ?? ($req['context'] ?? '?'),
                ];
            })->all(),
        );
        $this->info($events->count().' event(s). --full for complete context (request payload, call path, clock state); --clear to purge.');

        return self::SUCCESS;
    }
}
