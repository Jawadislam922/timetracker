<?php

namespace App\Http\Controllers;

use App\Services\ActivityDigestService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Internal system panel for Super Admins. Shows environment/health state and
 * exposes a fixed whitelist of safe maintenance actions. Never accepts
 * arbitrary commands and never reveals secrets.
 */
class DeveloperController extends Controller
{
    private const ACTIONS = [
        'optimize',
        'optimize_clear',
        'slack_test',
        'digest_preview',
        'prune_dry_run',
        'migrate',
    ];

    public function index(Request $request): Response
    {
        $this->authorizeDeveloper($request);

        return Inertia::render('Developer/Index', [
            'system' => $this->systemInfo(),
            'health' => $this->healthChecks(),
            'schedule' => $this->scheduleInfo(),
            'lastOutput' => session('dev_output'),
            'lastAction' => session('dev_action'),
        ]);
    }

    public function run(Request $request): RedirectResponse
    {
        $this->authorizeDeveloper($request);

        $action = (string) $request->validate([
            'action' => ['required', 'string', 'in:'.implode(',', self::ACTIONS)],
        ])['action'];

        [$message, $output] = match ($action) {
            'optimize' => $this->runOptimize(),
            'optimize_clear' => $this->runOptimizeClear(),
            'slack_test' => $this->runSlackTest(),
            'digest_preview' => $this->runDigestPreview(),
            'prune_dry_run' => $this->runPruneDryRun(),
            'migrate' => $this->runMigrate(),
        };

        return back()
            ->with('success', $message)
            ->with('dev_action', $action)
            ->with('dev_output', $output);
    }

    public function logs(Request $request): JsonResponse
    {
        $this->authorizeDeveloper($request);

        return response()->json([
            'file' => $this->latestLogFile() ? basename($this->latestLogFile()) : null,
            'lines' => $this->tailLog(300),
        ]);
    }

    private function authorizeDeveloper(Request $request): void
    {
        abort_unless($request->user()?->isSuperAdmin(), 403, 'Developer tools are restricted to Super Admins.');
    }

    /** @return array<string, mixed> */
    private function systemInfo(): array
    {
        $manifest = public_path('build/manifest.json');
        $rendererIndex = base_path('desktop/renderer/dist/index.html');

        return [
            'app_env' => config('app.env'),
            'app_debug' => (bool) config('app.debug'),
            'app_url' => config('app.url'),
            'app_timezone' => config('app.timezone'),
            'server_time' => now()->toDateTimeString(),
            'php_version' => PHP_VERSION,
            'laravel_version' => app()->version(),
            'db_connection' => config('database.default'),
            'db_database' => config('database.connections.'.config('database.default').'.database'),
            'cache_driver' => config('cache.default'),
            'session_driver' => config('session.driver'),
            'queue_driver' => config('queue.default'),
            'config_cached' => file_exists(base_path('bootstrap/cache/config.php')),
            'routes_cached' => file_exists(base_path('bootstrap/cache/routes-v7.php')),
            'web_build_at' => is_file($manifest) ? Carbon::createFromTimestamp(filemtime($manifest))->toDateTimeString() : null,
            'desktop_build_at' => is_file($rendererIndex) ? Carbon::createFromTimestamp(filemtime($rendererIndex))->toDateTimeString() : null,
            'git' => $this->gitInfo(),
        ];
    }

    /** @return array<string, mixed> */
    private function gitInfo(): array
    {
        try {
            $base = base_path();
            $commit = trim((string) @shell_exec('git -C "'.$base.'" log -1 --format=%h 2>NUL'));
            $branch = trim((string) @shell_exec('git -C "'.$base.'" rev-parse --abbrev-ref HEAD 2>NUL'));
            $dirty = trim((string) @shell_exec('git -C "'.$base.'" status --porcelain 2>NUL'));

            return [
                'commit' => $commit ?: null,
                'branch' => $branch ?: null,
                'dirty_files' => $dirty === '' ? 0 : count(explode("\n", $dirty)),
            ];
        } catch (\Throwable $e) {
            return ['commit' => null, 'branch' => null, 'dirty_files' => null];
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function healthChecks(): array
    {
        $checks = [];

        // Database
        try {
            $start = microtime(true);
            DB::select('select 1');
            $checks[] = ['name' => 'Database', 'ok' => true, 'detail' => round((microtime(true) - $start) * 1000).' ms'];
        } catch (\Throwable $e) {
            $checks[] = ['name' => 'Database', 'ok' => false, 'detail' => $e->getMessage()];
        }

        // Cache round-trip
        try {
            Cache::put('dev.health', 'ok', 10);
            $ok = Cache::get('dev.health') === 'ok';
            $checks[] = ['name' => 'Cache', 'ok' => $ok, 'detail' => config('cache.default')];
        } catch (\Throwable $e) {
            $checks[] = ['name' => 'Cache', 'ok' => false, 'detail' => $e->getMessage()];
        }

        // Storage disks
        foreach (['public', 'screenshots'] as $disk) {
            try {
                $probe = 'dev-health-probe.txt';
                Storage::disk($disk)->put($probe, 'ok');
                $ok = Storage::disk($disk)->exists($probe);
                Storage::disk($disk)->delete($probe);
                $checks[] = ['name' => "Storage: {$disk}", 'ok' => $ok, 'detail' => $ok ? 'writable' : 'not writable'];
            } catch (\Throwable $e) {
                $checks[] = ['name' => "Storage: {$disk}", 'ok' => false, 'detail' => $e->getMessage()];
            }
        }

        // Slack webhook configured (never reveal the URL)
        $checks[] = [
            'name' => 'Slack webhook',
            'ok' => filled(config('services.slack_reports.webhook_url')),
            'detail' => filled(config('services.slack_reports.webhook_url')) ? 'configured' : 'not set',
        ];

        // Pending migrations
        try {
            $migrator = app('migrator');
            $files = $migrator->getMigrationFiles(database_path('migrations'));
            $ran = $migrator->repositoryExists() ? $migrator->getRepository()->getRan() : [];
            $pending = array_diff(array_keys($files), $ran);
            $checks[] = [
                'name' => 'Migrations',
                'ok' => count($pending) === 0,
                'detail' => count($pending) === 0 ? 'up to date' : count($pending).' pending',
            ];
        } catch (\Throwable $e) {
            $checks[] = ['name' => 'Migrations', 'ok' => false, 'detail' => $e->getMessage()];
        }

        return $checks;
    }

    /** @return array<int, array<string, mixed>> */
    private function scheduleInfo(): array
    {
        return [
            [
                'name' => 'Weekly Slack work-hours report',
                'enabled' => (bool) config('services.slack_reports.weekly_enabled'),
                'when' => 'Sundays 10:00 '.config('services.slack_reports.timezone', 'Asia/Karachi'),
            ],
            [
                'name' => 'Daily Slack activity digest',
                'enabled' => (bool) config('services.slack_reports.daily_digest_enabled'),
                'when' => 'Daily '.config('services.slack_reports.daily_digest_time', '09:00').' '.config('services.slack_reports.timezone', 'Asia/Karachi'),
            ],
            [
                'name' => 'Screenshot retention prune',
                'enabled' => true,
                'when' => 'Daily 02:30 '.config('services.slack_reports.timezone', 'Asia/Karachi'),
            ],
        ];
    }

    /** @return array{0: string, 1: string} */
    private function runOptimize(): array
    {
        Artisan::call('optimize');

        return ['Caches built (config, routes, views). Remember: run "Clear caches" before php artisan test.', trim(Artisan::output())];
    }

    /** @return array{0: string, 1: string} */
    private function runOptimizeClear(): array
    {
        Artisan::call('optimize:clear');

        return ['All caches cleared. Safe to run the test suite now.', trim(Artisan::output())];
    }

    /** @return array{0: string, 1: string} */
    private function runSlackTest(): array
    {
        $webhook = config('services.slack_reports.webhook_url');

        if (blank($webhook)) {
            return ['Slack webhook is not configured (SLACK_REPORT_WEBHOOK_URL).', 'No request sent.'];
        }

        try {
            $response = Http::asJson()->timeout(10)->post($webhook, [
                'text' => ':white_check_mark: Timetracker developer test — webhook is working. ('.now()->toDateTimeString().')',
            ]);

            return $response->successful()
                ? ['Slack accepted the test message. Check the channel.', 'HTTP '.$response->status()]
                : ['Slack rejected the request — the webhook is probably revoked/rotated.', 'HTTP '.$response->status().' '.$response->body()];
        } catch (\Throwable $e) {
            return ['Could not reach Slack.', $e->getMessage()];
        }
    }

    /** @return array{0: string, 1: string} */
    private function runDigestPreview(): array
    {
        $tz = config('services.slack_reports.timezone', 'Asia/Karachi');
        $start = Carbon::now($tz)->subDay()->startOfDay();
        $end = $start->copy()->endOfDay();

        $service = app(ActivityDigestService::class);
        $payload = $service->buildPayload($start, $end);
        $message = $service->formatSlack($payload);

        return ['Digest preview built for '.$payload['range']['label'].' (nothing was sent to Slack).', $message['text']];
    }

    /** @return array{0: string, 1: string} */
    private function runPruneDryRun(): array
    {
        Artisan::call('monitoring:prune-screenshots', ['--dry-run' => true]);

        return ['Retention dry-run complete (nothing deleted).', trim(Artisan::output())];
    }

    /** @return array{0: string, 1: string} */
    private function runMigrate(): array
    {
        if (! app()->environment('local')) {
            return ['Migrate from the browser is only allowed in the local environment.', 'Blocked: APP_ENV='.config('app.env')];
        }

        Artisan::call('migrate', ['--force' => true]);

        return ['Migrations run against the local database.', trim(Artisan::output())];
    }

    private function latestLogFile(): ?string
    {
        $files = glob(storage_path('logs/*.log')) ?: [];
        if (empty($files)) {
            return null;
        }

        usort($files, fn ($a, $b) => filemtime($b) <=> filemtime($a));

        return $files[0];
    }

    /** @return array<int, string> */
    private function tailLog(int $lines): array
    {
        $file = $this->latestLogFile();
        if (! $file || ! is_readable($file)) {
            return [];
        }

        // Read the last ~128KB and split into lines; plenty for a tail view.
        $size = filesize($file);
        $chunk = min($size, 131072);
        $handle = fopen($file, 'rb');
        if (! $handle) {
            return [];
        }
        fseek($handle, -$chunk, SEEK_END);
        $content = (string) stream_get_contents($handle);
        fclose($handle);

        $all = preg_split("/\r?\n/", trim($content)) ?: [];

        return array_slice($all, -$lines);
    }
}
