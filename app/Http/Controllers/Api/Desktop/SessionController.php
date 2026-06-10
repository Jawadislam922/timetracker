<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Desktop\HeartbeatRequest;
use App\Http\Requests\Desktop\StartSessionRequest;
use App\Http\Requests\Desktop\StopSessionRequest;
use App\Models\Client;
use App\Models\TrackingSession;
use App\Models\UpworkProfile;
use App\Models\WorkHour;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SessionController extends Controller
{
    /**
     * Start a new tracking session. Idempotent on (user_id, client_uuid)
     * so the desktop app can safely retry after a flaky upload.
     */
    public function start(StartSessionRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $client = isset($data['client_id'])
            ? Client::query()->find($data['client_id'])
            : null;

        $session = TrackingSession::firstOrCreate(
            [
                'user_id' => $user->id,
                'client_uuid' => $data['client_uuid'],
            ],
            [
                'client_id' => $data['client_id'] ?? null,
                'upwork_profile_id' => $client?->upwork_profile_id ?? ($data['upwork_profile_id'] ?? null),
                // Prefer the per-entry work type the user picked in the desktop
                // app (tracker/manual/fixed/...). Fall back to deriving from the
                // client, and never store the client-level "tracker_manual"
                // engagement type as a per-entry category.
                'work_type' => $this->normaliseWorkType($data['work_type'] ?? $client?->work_type),
                'task_note' => $data['task_note'] ?? null,
                'started_at' => $data['started_at'],
                'last_heartbeat_at' => $data['started_at'],
                'status' => TrackingSession::STATUS_ACTIVE,
                'source' => 'desktop',
                'device_name' => $data['device_name'] ?? null,
                'platform' => $data['platform'] ?? null,
                'app_version' => $data['app_version'] ?? null,
            ],
        );

        return response()->json([
            'id' => $session->id,
            'status' => $session->status,
            'started_at' => $session->started_at?->toIso8601String(),
            'client_uuid' => $session->client_uuid,
        ], 201);
    }

    public function heartbeat(HeartbeatRequest $request, TrackingSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        $data = $request->validated();

        $session->update([
            'total_seconds' => $data['total_seconds'],
            'activity_percent' => $data['activity_percent'] ?? $session->activity_percent,
            'last_heartbeat_at' => $data['heartbeat_at'] ?? now(),
        ]);

        return response()->json(['status' => 'ok']);
    }

    public function stop(StopSessionRequest $request, TrackingSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        $data = $request->validated();

        $session->update([
            'stopped_at' => $data['stopped_at'],
            'total_seconds' => $data['total_seconds'],
            'activity_percent' => $data['activity_percent'] ?? $session->activity_percent,
            'task_note' => $data['task_note'] ?? $session->task_note,
            'status' => TrackingSession::STATUS_STOPPED,
            'last_heartbeat_at' => now(),
        ]);

        $this->syncWorkHourFromSession($session->fresh());

        return response()->json([
            'id' => $session->id,
            'status' => $session->status,
            'stopped_at' => $session->stopped_at?->toIso8601String(),
        ]);
    }

    /**
     * Mirror a finished tracking session into the work_hours table so the
     * existing Report sheet auto-populates without manual entry.
     */
    private function syncWorkHourFromSession(TrackingSession $session): void
    {
        if (! $session->total_seconds || $session->total_seconds < 60) {
            return;
        }

        $trackerName = $session->upwork_profile_id
            ? UpworkProfile::query()->where('id', $session->upwork_profile_id)->value('name')
            : null;

        WorkHour::updateOrCreate(
            ['tracking_session_id' => $session->id],
            [
                'user_id' => $session->user_id,
                'date' => $session->started_at?->toDateString() ?? now()->toDateString(),
                'hours' => round($session->total_seconds / 3600, 4),
                'description' => $session->task_note ?: 'Tracked via desktop',
                'work_type' => $this->normaliseWorkType($session->work_type) ?: 'tracker',
                'client_id' => $session->client_id,
                'tracker' => $trackerName,
                'source' => 'tracker',
            ]
        );
    }

    /**
     * Map a stored work type to a valid per-entry billing category. The
     * client-level "tracker_manual" engagement type defaults to "tracker"
     * (the desktop app records tracked time); users choose tracker/manual
     * explicitly in the app.
     */
    private function normaliseWorkType(?string $workType): ?string
    {
        if ($workType === null || $workType === '') {
            return null;
        }

        return $workType === 'tracker_manual' ? 'tracker' : $workType;
    }

    /**
     * Per-day totals for the trailing 7 days (including today), for the
     * desktop week chart.
     */
    public function week(Request $request): JsonResponse
    {
        $end = now()->endOfDay();
        $start = now()->subDays(6)->startOfDay();

        $perDay = TrackingSession::forUser($request->user()->id)
            ->whereBetween('started_at', [$start, $end])
            ->selectRaw('DATE(started_at) as d, SUM(total_seconds) as secs')
            ->groupBy('d')
            ->pluck('secs', 'd');

        $days = [];
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            $iso = $cursor->toDateString();
            $days[] = [
                'date' => $iso,
                'weekday' => $cursor->format('D'),
                'total_seconds' => (int) ($perDay[$iso] ?? 0),
                'is_today' => $cursor->isToday(),
            ];
        }

        return response()->json(['days' => $days]);
    }

    public function today(Request $request): JsonResponse
    {
        $sessions = TrackingSession::forUser($request->user()->id)
            ->with(['client:id,name', 'upworkProfile:id,name'])
            ->whereDate('started_at', now()->toDateString())
            ->orderBy('started_at', 'desc')
            ->get(['id', 'client_uuid', 'client_id', 'upwork_profile_id', 'work_type', 'task_note', 'started_at', 'stopped_at', 'total_seconds', 'status'])
            ->map(fn (TrackingSession $session) => [
                'id' => $session->id,
                'client_uuid' => $session->client_uuid,
                'client_id' => $session->client_id,
                'client_name' => $session->client?->name,
                'upwork_profile_id' => $session->upwork_profile_id,
                'upwork_profile_name' => $session->upworkProfile?->name,
                'work_type' => $session->work_type,
                'task_note' => $session->task_note,
                'started_at' => $session->started_at?->toIso8601String(),
                'stopped_at' => $session->stopped_at?->toIso8601String(),
                'total_seconds' => $session->total_seconds,
                'status' => $session->status,
            ]);

        return response()->json(['sessions' => $sessions]);
    }
}
