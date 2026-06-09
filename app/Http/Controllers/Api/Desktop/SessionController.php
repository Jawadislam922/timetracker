<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Desktop\HeartbeatRequest;
use App\Http\Requests\Desktop\StartSessionRequest;
use App\Http\Requests\Desktop\StopSessionRequest;
use App\Models\TrackingSession;
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

        $session = TrackingSession::firstOrCreate(
            [
                'user_id' => $user->id,
                'client_uuid' => $data['client_uuid'],
            ],
            [
                'client_id' => $data['client_id'] ?? null,
                'upwork_profile_id' => $data['upwork_profile_id'] ?? null,
                'work_type' => $data['work_type'] ?? null,
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

        return response()->json([
            'id' => $session->id,
            'status' => $session->status,
            'stopped_at' => $session->stopped_at?->toIso8601String(),
        ]);
    }

    public function today(Request $request): JsonResponse
    {
        $sessions = TrackingSession::forUser($request->user()->id)
            ->whereDate('started_at', now()->toDateString())
            ->orderBy('started_at', 'desc')
            ->get(['id', 'client_uuid', 'client_id', 'work_type', 'task_note', 'started_at', 'stopped_at', 'total_seconds', 'status']);

        return response()->json(['sessions' => $sessions]);
    }
}
