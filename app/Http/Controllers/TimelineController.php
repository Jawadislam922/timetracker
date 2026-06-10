<?php

namespace App\Http\Controllers;

use App\Models\MonitoringSetting;
use App\Models\TrackingActivitySample;
use App\Models\TrackingAuditLog;
use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use App\Models\User;
use App\Support\BusinessTime;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

class TimelineController extends Controller
{
    public function index(Request $request): Response
    {
        $authUser = $request->user();
        $canViewOthers = $authUser->hasPermission('timeline.view_others');

        $targetUser = $this->resolveTargetUser($request, $authUser, $canViewOthers);
        $date = $this->resolveDate($request);

        $users = $canViewOthers
            ? User::orderBy('name')->get(['id', 'name', 'email', 'role'])
            : collect([['id' => $authUser->id, 'name' => $authUser->name, 'email' => $authUser->email, 'role' => $authUser->role]]);

        return Inertia::render('Timeline/Index', [
            'targetUser' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
            ],
            'date' => $date->toDateString(),
            'users' => $users,
            'permissions' => [
                'view_screenshots' => $authUser->hasPermission('monitoring.view_screenshots') || $targetUser->id === $authUser->id,
                'view_others' => $canViewOthers,
                'add_offline_time' => (bool) ($authUser->can_create_manual_work_hour ?? false),
                'manage_screenshots' => $authUser->id === $targetUser->id || $authUser->hasPermission('monitoring.manage'),
                'delete_screenshots' => $authUser->hasPermission('monitoring.delete_screenshots'),
            ],
            'initialData' => $this->buildDayPayload($targetUser, $date, $authUser),
            'weekStartsOn' => MonitoringSetting::current()->week_starts_on,
        ]);
    }

    public function data(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $canViewOthers = $authUser->hasPermission('timeline.view_others');

        $targetUser = $this->resolveTargetUser($request, $authUser, $canViewOthers);
        $date = $this->resolveDate($request);

        return response()->json($this->buildDayPayload($targetUser, $date, $authUser));
    }

    public function history(Request $request): JsonResponse
    {
        $authUser = $request->user();
        $canViewOthers = $authUser->hasPermission('timeline.view_others');

        $targetUser = $this->resolveTargetUser($request, $authUser, $canViewOthers);
        $date = $this->resolveDate($request);

        [$utcStart, $utcEnd] = BusinessTime::utcRange($date->copy()->startOfDay(), $date->copy()->endOfDay());

        $logs = TrackingAuditLog::with(['actor:id,name'])
            ->where('subject_user_id', $targetUser->id)
            ->where(function ($q) use ($date, $utcStart, $utcEnd) {
                $q->whereDate('event_date', $date->toDateString())
                    ->orWhereBetween('created_at', [$utcStart, $utcEnd]);
            })
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        return response()->json([
            'logs' => $logs->map(fn (TrackingAuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'action_label' => $this->humanizeAction($log->action),
                'reason' => $log->reason,
                'old_value' => $log->old_value,
                'new_value' => $log->new_value,
                'actor_name' => $log->actor?->name ?? 'System',
                'created_at' => $log->created_at?->toIso8601String(),
                'tracking_screenshot_id' => $log->tracking_screenshot_id,
                'tracking_session_id' => $log->tracking_session_id,
            ])->values(),
        ]);
    }

    private function humanizeAction(string $action): string
    {
        return [
            'screenshot.flag' => 'Flagged screenshot',
            'screenshot.unflag' => 'Removed flag from screenshot',
            'screenshot.delete' => 'Deleted screenshot',
            'session.note_edit' => 'Edited session note',
            'session.abandon' => 'Marked session abandoned',
        ][$action] ?? $action;
    }

    /** @return array<string, mixed> */
    private function buildDayPayload(User $targetUser, Carbon $date, User $authUser): array
    {
        $canViewScreenshots = $authUser->id === $targetUser->id
            || $authUser->hasPermission('monitoring.view_screenshots');

        // $date arrives in the business timezone; queries need UTC bounds
        // because rows are stored in UTC.
        $dayStart = $date->copy()->startOfDay();
        $dayEnd = $date->copy()->endOfDay();
        $weekStartsOn = MonitoringSetting::current()->week_starts_on;
        $weekStart = $weekStartsOn === 'sunday'
            ? $date->copy()->startOfWeek(Carbon::SUNDAY)
            : $date->copy()->startOfWeek(Carbon::MONDAY);
        $weekEnd = $weekStart->copy()->addDays(6)->endOfDay();
        $monthStart = $date->copy()->startOfMonth();
        $monthEnd = $date->copy()->endOfMonth();

        $sessions = TrackingSession::with(['client:id,name', 'upworkProfile:id,name'])
            ->where('user_id', $targetUser->id)
            ->whereBetween('started_at', BusinessTime::utcRange($dayStart, $dayEnd))
            ->orderBy('started_at')
            ->get();

        $sessionIds = $sessions->pluck('id');

        $screenshots = $canViewScreenshots
            ? TrackingScreenshot::whereIn('tracking_session_id', $sessionIds)
                ->orderBy('captured_at')
                ->get([
                    'id', 'tracking_session_id', 'captured_at', 'thumbnail_path', 'image_path',
                    'activity_percent', 'active_app', 'active_window_title', 'url_domain', 'is_flagged',
                ])
            : collect();

        $shotsBySession = $screenshots->groupBy('tracking_session_id');

        $samples = TrackingActivitySample::whereIn('tracking_session_id', $sessionIds)
            ->orderBy('captured_at')
            ->get(['id', 'tracking_session_id', 'captured_at', 'keyboard_count', 'mouse_count', 'idle_seconds', 'active_app', 'url_domain']);

        $samplesBySession = $samples->groupBy('tracking_session_id');
        $sampleIntervalSeconds = MonitoringSetting::current()->activity_sample_interval_seconds ?: 60;

        $sessionPayload = $sessions->map(function (TrackingSession $session) use ($shotsBySession, $samplesBySession, $sampleIntervalSeconds, $canViewScreenshots) {
            $rows = ($shotsBySession[$session->id] ?? collect());
            $sessionSamples = $samplesBySession[$session->id] ?? collect();

            return [
                'id' => $session->id,
                'client_name' => $session->client?->name,
                'task_note' => $session->task_note,
                'work_type' => $session->work_type,
                'tracker' => $session->upworkProfile?->name,
                'started_at' => $session->started_at?->toIso8601String(),
                'stopped_at' => $session->stopped_at?->toIso8601String(),
                'total_seconds' => (int) $session->total_seconds,
                'activity_percent' => (int) $session->activity_percent,
                'status' => $session->status,
                'screenshots' => $canViewScreenshots
                    ? $rows->map(fn (TrackingScreenshot $s) => [
                        'id' => $s->id,
                        'captured_at' => $s->captured_at?->toIso8601String(),
                        'thumbnail_url' => $s->thumbnail_url,
                        'image_url' => $s->image_url,
                        'activity_percent' => (int) $s->activity_percent,
                        'active_app' => $s->active_app,
                        'active_window_title' => $s->active_window_title,
                        'url_domain' => $s->url_domain,
                        'is_flagged' => (bool) $s->is_flagged,
                    ])->values()
                    : [],
                'screenshot_count_hidden' => $canViewScreenshots ? 0 : (int) $rows->count(),
                'apps' => $this->rollupBy($sessionSamples, 'active_app', $sampleIntervalSeconds),
                'urls' => $this->rollupBy($sessionSamples, 'url_domain', $sampleIntervalSeconds),
            ];
        })->values();

        $totalsScope = fn (Carbon $from, Carbon $to) => (int) TrackingSession::where('user_id', $targetUser->id)
            ->whereBetween('started_at', BusinessTime::utcRange($from, $to))
            ->sum('total_seconds');

        $clientBreakdown = $sessions
            ->groupBy(fn (TrackingSession $s) => $s->client?->name ?: 'Unassigned')
            ->map(fn ($group, $name) => [
                'client' => $name,
                'total_seconds' => (int) $group->sum('total_seconds'),
            ])
            ->values();

        return [
            'date' => $date->toDateString(),
            'day_label' => $date->translatedFormat('l, F j'),
            'sessions' => $sessionPayload,
            'totals' => [
                'day' => (int) $sessions->sum('total_seconds'),
                'week' => $totalsScope($weekStart, $weekEnd),
                'month' => $totalsScope($monthStart, $monthEnd),
            ],
            'week_range' => [
                'start' => $weekStart->toDateString(),
                'end' => $weekEnd->toDateString(),
            ],
            'month_strip' => $this->monthStrip($date, $targetUser->id),
            'client_breakdown' => $clientBreakdown,
            'day_apps' => $this->rollupBy($samples, 'active_app', $sampleIntervalSeconds, 10),
            'day_urls' => $this->rollupBy($samples, 'url_domain', $sampleIntervalSeconds, 10),
            'activity_bands' => $this->activityBands($samples, $sampleIntervalSeconds),
            'sample_interval_seconds' => (int) $sampleIntervalSeconds,
        ];
    }

    /**
     * Roll up activity samples by a given key (app or domain) into time spent.
     *
     * @return array<int, array<string, mixed>>
     */
    private function rollupBy(Collection $samples, string $key, int $intervalSeconds, int $limit = 12): array
    {
        return $samples
            ->filter(fn ($s) => ! empty($s->{$key}))
            ->groupBy($key)
            ->map(fn ($group, $name) => [
                'name' => $name,
                'samples' => $group->count(),
                'total_seconds' => $group->count() * $intervalSeconds,
            ])
            ->sortByDesc('total_seconds')
            ->values()
            ->take($limit)
            ->all();
    }

    /**
     * Bucket activity samples into 6-minute (10-per-hour) slots and tag each
     * slot active / idle / quiet so the front-end can render bands across the
     * 24h ruler.
     *
     * @return array<int, array<string, mixed>>
     */
    private function activityBands(Collection $samples, int $intervalSeconds): array
    {
        $slotsPerHour = 10;        // 6-minute slots
        $totalSlots = 24 * $slotsPerHour;
        $bands = array_fill(0, $totalSlots, ['active' => 0, 'idle' => 0]);

        $tz = BusinessTime::tz();

        foreach ($samples as $sample) {
            $captured = $sample->captured_at?->copy()->setTimezone($tz);
            if (! $captured) {
                continue;
            }
            $slot = ($captured->hour * $slotsPerHour) + (int) floor($captured->minute / (60 / $slotsPerHour));
            if ($slot < 0 || $slot >= $totalSlots) {
                continue;
            }

            $isActive = ($sample->keyboard_count + $sample->mouse_count) > 0 && $sample->idle_seconds < $intervalSeconds;
            $bands[$slot][$isActive ? 'active' : 'idle']++;
        }

        $out = [];
        foreach ($bands as $i => $counts) {
            if ($counts['active'] === 0 && $counts['idle'] === 0) {
                continue;
            }
            $state = $counts['active'] >= $counts['idle'] ? 'active' : 'idle';
            $out[] = [
                'slot' => $i,
                'hour' => (int) floor($i / $slotsPerHour),
                'minute' => ($i % $slotsPerHour) * (60 / $slotsPerHour),
                'state' => $state,
                'samples' => $counts['active'] + $counts['idle'],
            ];
        }

        return $out;
    }

    /** @return array<int, array<string, mixed>> */
    private function monthStrip(Carbon $date, int $userId): array
    {
        $start = $date->copy()->startOfMonth();
        $end = $date->copy()->endOfMonth();

        // Bucket in PHP by business-tz date: SQL DATE() would group by the
        // stored UTC date and shift late-evening sessions onto the wrong day.
        $perDay = TrackingSession::query()
            ->where('user_id', $userId)
            ->whereBetween('started_at', BusinessTime::utcRange($start, $end))
            ->get(['started_at', 'total_seconds'])
            ->groupBy(fn (TrackingSession $s) => BusinessTime::dateKey($s->started_at))
            ->map(fn ($group) => (int) $group->sum('total_seconds'));

        $today = BusinessTime::today();

        $out = [];
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            $iso = $cursor->toDateString();
            $out[] = [
                'date' => $iso,
                'day' => (int) $cursor->day,
                'weekday' => $cursor->translatedFormat('D'),
                'total_seconds' => (int) ($perDay[$iso] ?? 0),
                'is_today' => $cursor->isSameDay($today),
                'is_selected' => $cursor->isSameDay($date),
            ];
        }

        return $out;
    }

    private function resolveTargetUser(Request $request, User $authUser, bool $canViewOthers): User
    {
        $requested = (int) $request->input('user_id', 0);

        if (! $canViewOthers || ! $requested || $requested === $authUser->id) {
            return $authUser;
        }

        return User::query()->findOrFail($requested);
    }

    private function resolveDate(Request $request): Carbon
    {
        return BusinessTime::parseDate($request->input('date'));
    }
}
