<?php

namespace App\Console\Commands;

use App\Support\Diagnostics;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

/**
 * One place to see everything the app has captured across every category —
 * errors, attendance mis-files, tracker-health events, desktop reports.
 * `php artisan diagnostics` lists categories; `diagnostics errors --full`
 * dumps a category.
 */
class DiagnosticsCommand extends Command
{
    protected $signature = 'diagnostics
        {category? : Category to show (errors, attendance, tracker-health, desktop…); omit to list all}
        {--limit=25 : Max events to show, newest first}
        {--full : Dump complete JSON of each event}
        {--clear : Delete all events in the given category}';

    protected $description = 'View captured diagnostics across the whole app (errors + domain events) in one place.';

    public function handle(): int
    {
        $base = Diagnostics::baseDir();
        $category = $this->argument('category');

        if (! File::isDirectory($base)) {
            $this->info("No diagnostics captured yet ({$base}).");

            return self::SUCCESS;
        }

        if (! $category) {
            $rows = collect(File::directories($base))->map(function ($dir) {
                $files = File::files($dir);
                $latest = collect($files)->max(fn ($f) => $f->getFilename());

                return [basename($dir), count($files), $latest ? Str::of($latest)->after('')->before('-')->toString() : '—'];
            })->sortByDesc(fn ($r) => $r[1])->values();

            if ($rows->isEmpty()) {
                $this->info('No diagnostics captured yet.');

                return self::SUCCESS;
            }

            $this->table(['category', 'events', 'latest file'], $rows->map(fn ($r) => [$r[0], $r[1], $r[2]])->all());
            $this->info('Show one with:  php artisan diagnostics <category> [--full]');

            return self::SUCCESS;
        }

        $dir = Diagnostics::dir($category);
        if (! File::isDirectory($dir)) {
            $this->warn("No such category: {$category}");

            return self::SUCCESS;
        }

        if ($this->option('clear')) {
            File::deleteDirectory($dir);
            $this->info("Cleared category '{$category}'.");

            return self::SUCCESS;
        }

        $events = collect(File::files($dir))
            ->sortByDesc(fn ($f) => $f->getFilename())
            ->take((int) $this->option('limit'))
            ->map(fn ($f) => json_decode(File::get($f->getPathname()), true) ?: []);

        if ($events->isEmpty()) {
            $this->info("No events in '{$category}'.");

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
            ['captured', 'summary'],
            $events->map(fn ($e) => [
                $e['captured_at'] ?? '?',
                Str::limit($e['summary'] ?? $e['decision'] ?? self::preview($e), 90),
            ])->all(),
        );
        $this->info($events->count()." event(s) in '{$category}'. --full for complete context.");

        return self::SUCCESS;
    }

    /** Best-effort one-liner for events without an explicit summary. */
    private static function preview(array $e): string
    {
        foreach (['entry', 'session', 'exception', 'request'] as $k) {
            if (isset($e[$k]) && is_array($e[$k])) {
                return $k.': '.json_encode($e[$k], JSON_UNESCAPED_SLASHES);
            }
        }

        return json_encode($e, JSON_UNESCAPED_SLASHES);
    }
}
