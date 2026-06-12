<?php

namespace App\Http\Controllers;

use App\Models\MonitoringSetting;
use App\Models\TrackingActivitySample;
use App\Models\TrackingSession;
use App\Models\User;
use App\Services\ActivityDigestService;
use App\Support\BusinessTime;
use App\Support\WebDomain;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;

class TeamController extends Controller
{
    public function index(Request $request): Response
    {
        $authUser = $request->user();
        abort_unless($authUser->hasPermission('timeline.view_others'), 403);

        $date = $this->resolveDate($request);
        [$dayStart, $dayEnd] = BusinessTime::utcRange($date->copy()->startOfDay(), $date->copy()->endOfDay());

        $users = User::orderBy('name')->get(['id', 'name', 'email', 'role', 'designation', 'avatar']);

        // Per-user session totals for the day.
        $sessions = TrackingSession::with('client:id,name')
            ->whereBetween('started_at', [$dayStart, $dayEnd])
            ->get(['id', 'user_id', 'client_id', 'started_at', 'stopped_at', 'last_heartbeat_at', 'total_seconds', 'activity_percent', 'status']);

        $sessionsByUser = $sessions->groupBy('user_id');

        $sampleIntervalSeconds = 60;
        $samples = TrackingActivitySample::query()
            ->whereBetween('captured_at', [$dayStart, $dayEnd])
            ->whereIn('user_id', $users->pluck('id'))
            ->get(['id', 'user_id', 'tracking_session_id', 'captured_at', 'keyboard_count', 'mouse_count', 'idle_seconds', 'active_app', 'url_domain']);

        $samplesByUser = $samples->groupBy('user_id');

        // Active sessions snapshot (anyone running right now, regardless of date).
        $activeNow = TrackingSession::active()
            ->with('client:id,name')
            ->get(['id', 'user_id', 'client_id', 'task_note', 'started_at', 'last_heartbeat_at', 'activity_percent'])
            ->keyBy('user_id');

        $rows = $users->map(function (User $u) use ($sessionsByUser, $samplesByUser, $sampleIntervalSeconds, $activeNow) {
            $userSessions = $sessionsByUser[$u->id] ?? collect();
            $userSamples = $samplesByUser[$u->id] ?? collect();

            $totalSeconds = (int) $userSessions->sum('total_seconds');
            $activitySamples = $userSamples->filter(fn ($s) => ($s->keyboard_count + $s->mouse_count) > 0 && $s->idle_seconds < $sampleIntervalSeconds);
            $activityPercent = $userSamples->count() > 0
                ? (int) round(($activitySamples->count() / $userSamples->count()) * 100)
                : 0;

            $topClient = $userSessions
                ->groupBy(fn ($s) => $s->client?->name ?: 'Unassigned')
                ->map(fn ($g, $name) => ['name' => $name, 'total_seconds' => (int) $g->sum('total_seconds')])
                ->sortByDesc('total_seconds')
                ->first();

            $topApp = $userSamples
                ->filter(fn ($s) => ! empty($s->active_app))
                ->groupBy('active_app')
                ->map(fn ($g, $name) => ['name' => $name, 'samples' => $g->count()])
                ->sortByDesc('samples')
                ->first();

            $lastHeartbeat = $userSessions
                ->pluck('last_heartbeat_at')
                ->filter()
                ->sortDesc()
                ->first();

            $live = $activeNow[$u->id] ?? null;

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'role' => $u->role,
                'designation' => $u->designation,
                'avatar_url' => $u->avatar_url,
                'total_seconds' => $totalSeconds,
                'activity_percent' => $activityPercent,
                'top_client' => $topClient,
                'top_app' => $topApp ? $topApp['name'] : null,
                'last_heartbeat_at' => $lastHeartbeat?->toIso8601String(),
                'is_live' => (bool) $live,
                'live' => $live ? [
                    'client' => $live->client?->name,
                    'task_note' => $live->task_note,
                    'started_at' => $live->started_at?->toIso8601String(),
                    'activity_percent' => (int) $live->activity_percent,
                ] : null,
            ];
        })->sortByDesc('total_seconds')->values();

        $totals = [
            'day' => (int) $sessions->sum('total_seconds'),
            'people_with_time' => $rows->filter(fn ($r) => $r['total_seconds'] > 0)->count(),
            'people_live' => $rows->filter(fn ($r) => $r['is_live'])->count(),
            'team_size' => $users->count(),
        ];

        return Inertia::render('Team/Index', [
            'date' => $date->toDateString(),
            'rows' => $rows,
            'totals' => $totals,
            'permissions' => [
                'view_screenshots' => $authUser->hasPermission('monitoring.view_screenshots'),
                'send_slack' => $authUser->hasPermission('reports.send_slack'),
            ],
            'slack' => [
                'configured' => app(ActivityDigestService::class)->configured(),
                'daily_enabled' => (bool) config('services.slack_reports.daily_digest_enabled'),
                'daily_time' => config('services.slack_reports.daily_digest_time', '09:00'),
            ],
        ]);
    }

    public function apps(Request $request): Response
    {
        $authUser = $request->user();
        abort_unless($authUser->hasPermission('timeline.view_others'), 403);

        $range = $request->input('range', '7d');
        [$start, $end] = $this->resolveRange($request, $range);
        $userId = (int) $request->input('user_id', 0);

        $sampleInterval = MonitoringSetting::current()->activity_sample_interval_seconds ?: 60;

        $samplesQuery = TrackingActivitySample::query()
            ->whereBetween('captured_at', BusinessTime::utcRange($start, $end));

        if ($userId > 0) {
            $samplesQuery->where('user_id', $userId);
        }

        $samples = $samplesQuery->get(['id', 'user_id', 'active_app', 'url_domain']);

        $userNames = User::whereIn('id', $samples->pluck('user_id')->unique())
            ->pluck('name', 'id');

        $rollup = function (string $key) use ($samples, $sampleInterval, $userNames) {
            return $samples
                ->filter(fn ($s) => ! empty($s->{$key}))
                // Normalize domains so www./bare variants roll up together
                // (older samples were stored unnormalized).
                ->groupBy(fn ($s) => $key === 'url_domain'
                    ? WebDomain::normalize($s->{$key})
                    : $s->{$key})
                ->map(function ($group, $name) use ($sampleInterval, $userNames) {
                    $byUser = $group->groupBy('user_id')
                        ->map(fn ($g) => $g->count())
                        ->sortDesc();

                    return [
                        'name' => $name,
                        'total_seconds' => $group->count() * $sampleInterval,
                        'user_count' => $byUser->count(),
                        'top_user' => $userNames[$byUser->keys()->first()] ?? null,
                    ];
                })
                ->sortByDesc('total_seconds')
                ->values()
                ->take(30)
                ->all();
        };

        return Inertia::render('Team/Apps', [
            'range' => $range,
            'start' => $start->toDateString(),
            'end' => $end->toDateString(),
            'userId' => $userId ?: null,
            'users' => User::orderBy('name')->get(['id', 'name']),
            'apps' => $rollup('active_app'),
            'urls' => $rollup('url_domain'),
            'totals' => [
                'tracked_seconds' => $samples->count() * $sampleInterval,
                'people' => $samples->pluck('user_id')->unique()->count(),
            ],
        ]);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function resolveRange(Request $request, string $range): array
    {
        $tz = BusinessTime::tz();

        if ($request->filled('start') && $request->filled('end')) {
            try {
                return [
                    Carbon::parse($request->input('start'), $tz)->startOfDay(),
                    Carbon::parse($request->input('end'), $tz)->endOfDay(),
                ];
            } catch (\Throwable $e) {
                // fall through to named ranges
            }
        }

        $today = BusinessTime::today();

        return match ($range) {
            'today' => [$today->copy(), $today->copy()->endOfDay()],
            '30d' => [$today->copy()->subDays(29), $today->copy()->endOfDay()],
            default => [$today->copy()->subDays(6), $today->copy()->endOfDay()],
        };
    }

    public function sendDigest(Request $request, ActivityDigestService $service): RedirectResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasPermission('reports.send_slack'), 403);

        $date = $this->resolveDate($request);

        try {
            $summary = $service->sendRange($date->copy()->startOfDay(), $date->copy()->endOfDay());
        } catch (RuntimeException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', sprintf(
            'Slack digest sent for %s (%d people, %sh tracked).',
            $summary['range']['label'],
            $summary['people'],
            number_format($summary['total_seconds'] / 3600, 2),
        ));
    }

    private function resolveDate(Request $request): Carbon
    {
        return BusinessTime::parseDate($request->input('date'));
    }
}
