<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Http\Requests\Desktop\HeartbeatRequest;
use App\Http\Requests\Desktop\StartSessionRequest;
use App\Http\Requests\Desktop\StopSessionRequest;
use App\Models\Client;
use App\Models\TimeEntry;
use App\Models\TrackingSession;
use App\Models\User;
use App\Services\TrackingSessionService;
use App\Support\BusinessTime;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SessionController extends Controller
{
    public function __construct(private TrackingSessionService $sessions) {}

    /**
     * Start a new tracking session. Idempotent on (user_id, client_uuid)
     * so the desktop app can safely retry after a flaky upload.
     */
    public function start(StartSessionRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $client = isset($data['client_id'])
            ? Client::query()->with('upworkProfiles:id')->find($data['client_id'])
            : null;

        // The client may have its profile linked via the legacy column OR the
        // newer client_upwork_profile pivot. Fall through both.
        $derivedProfileId = $client?->upwork_profile_id
            ?? $client?->upworkProfiles->first()?->id;

        $session = TrackingSession::firstOrCreate(
            [
                'user_id' => $user->id,
                'client_uuid' => $data['client_uuid'],
            ],
            [
                'client_id' => $data['client_id'] ?? null,
                'upwork_profile_id' => $derivedProfileId ?? ($data['upwork_profile_id'] ?? null),
                // Prefer the per-entry work type the user picked in the desktop
                // app (tracker/manual/fixed/...). Fall back to deriving from the
                // client, and never store the client-level "tracker_manual"
                // engagement type as a per-entry category.
                'work_type' => $this->sessions->normaliseWorkType($data['work_type'] ?? $client?->work_type),
                'task_note' => $data['task_note'] ?? null,
                // Desktop sends UTC ISO; convert to app timezone for storage so
                // it lines up with the rest of the data (see BusinessTime).
                'started_at' => BusinessTime::fromClient($data['started_at']) ?? now(),
                'last_heartbeat_at' => BusinessTime::fromClient($data['started_at']) ?? now(),
                'status' => TrackingSession::STATUS_ACTIVE,
                'source' => 'desktop',
                'device_name' => $data['device_name'] ?? null,
                'platform' => $data['platform'] ?? null,
                'app_version' => $data['app_version'] ?? null,
            ],
        );

        // Single-device tracking (last device wins): unless this user is allowed
        // to track on multiple devices, starting here stops any session still
        // running on another device, so the same wall-clock time is never
        // double-counted. The response reports what was stopped so the desktop
        // can tell the user.
        $stoppedDevices = [];
        if ($session->wasRecentlyCreated && ! $user->allow_multiple_devices) {
            $others = TrackingSession::where('user_id', $user->id)
                ->where('status', TrackingSession::STATUS_ACTIVE)
                ->where('id', '!=', $session->id)
                ->get();
            foreach ($others as $other) {
                $this->sessions->finalize($other);
                $stoppedDevices[] = $other->device_name ?: 'another device';
            }
        }

        // Starting the tracker means they're working — if they forgot to clock
        // in (or didn't know they had to), clock them in automatically at the
        // session's real start time. Only on a genuine new session, never on an
        // idempotent retry. If the day is already closed (clocked out), refuse:
        // drop the just-created empty session and tell the desktop to clock in
        // first, rather than re-opening the closed day.
        if ($session->wasRecentlyCreated && $this->reconcileClockState($user, $session) === 'stop') {
            $session->delete();

            return response()->json([
                'status' => TrackingSession::STATUS_STOPPED,
                'stopped_elsewhere' => true,
                'message' => 'You are clocked out for the day. Clock in before tracking.',
            ], 409);
        }

        return response()->json([
            'id' => $session->id,
            'status' => $session->status,
            'started_at' => $session->started_at?->toIso8601String(),
            'client_uuid' => $session->client_uuid,
            'stopped_other_devices' => $stoppedDevices,
        ], 201);
    }

    /**
     * Keep the attendance clock consistent with the tracker on every start and
     * heartbeat. The tracker is a *subset* of presence: a person may be clocked
     * in without tracking (e.g. HR who never run the app), but tracked time must
     * always sit inside a real clock-in window — you can never track while
     * "Not started". Returns 'stop' when the caller should finalize the session,
     * 'ok' otherwise.
     */
    private function reconcileClockState(User $user, TrackingSession $session): string
    {
        $last = TimeEntry::where('user_id', $user->id)
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->first();

        // clock_in / break_start / break_end all mean "still clocked in" — the
        // tracked time already sits inside an open window, nothing to do.
        if ($last && in_array($last->action_type, ['clock_in', 'break_start', 'break_end'], true)) {
            return 'ok';
        }

        $sessionStart = $session->started_at
            ? Carbon::parse($session->started_at)->setTimezone('Asia/Karachi')
            : Carbon::now('Asia/Karachi');

        // The day is already CLOSED: the last action is a clock-out whose
        // attendance day is the same as (or later than) this session's. The
        // person deliberately ended their day, so a tracker still running — OR a
        // fresh session started AFTER the clock-out — must STOP, never silently
        // re-open the closed day with a phantom second clock-in. (A clock-out
        // from a PRIOR day is a new day and falls through to a normal auto
        // clock-in below. Keyed on the attendance DAY, not the raw timestamp,
        // because a new session always starts after the clock-out instant.)
        if ($last && $last->action_type === 'clock_out') {
            $clockOutDate = $last->action_date instanceof Carbon
                ? $last->action_date->toDateString()
                : (string) $last->action_date;
            if ($clockOutDate >= $user->attendanceDateFor($sessionStart)) {
                return 'stop';
            }
        }

        // Tracking with no clock-in covering it → open one at the session's real
        // start time so in-office can never read less than tracked.
        TimeEntry::create([
            'user_id' => $user->id,
            'action_type' => 'clock_in',
            'action_timestamp' => $sessionStart,
            'action_date' => $user->attendanceDateFor($sessionStart),
            'action_time' => $sessionStart->toTimeString(),
            'notes' => 'Auto clock-in (started tracker)',
        ]);

        return 'ok';
    }

    public function heartbeat(HeartbeatRequest $request, TrackingSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        // If this session was already stopped (e.g. another device took over
        // under the single-device rule), don't let stale heartbeats re-inflate
        // its time. Signal the desktop so it can stop tracking locally.
        if ($session->status !== TrackingSession::STATUS_ACTIVE) {
            return response()->json([
                'status' => $session->status,
                'stopped_elsewhere' => true,
            ], 409);
        }

        $data = $request->validated();

        $hbAt = BusinessTime::fromClient($data['heartbeat_at'] ?? null) ?? now();
        $session->update([
            'total_seconds' => $this->clampTotalSeconds($session, (int) $data['total_seconds'], $hbAt),
            'activity_percent' => $data['activity_percent'] ?? $session->activity_percent,
            'last_heartbeat_at' => $hbAt,
        ]);

        $user = $request->user();

        // Keep the clock consistent with the tracker on every heartbeat. Tracking
        // with no open clock-in opens one; clocking out while the tracker kept
        // running stops it (so we never record un-clocked time).
        if ($this->reconcileClockState($user, $session) === 'stop') {
            $this->sessions->finalize($session);

            return response()->json([
                'status' => TrackingSession::STATUS_STOPPED,
                'stopped_elsewhere' => true,
            ], 409);
        }

        // Tell the desktop the user's current clock state so a break started on
        // the web dashboard also pauses the tracker (the desktop pauses when it
        // sees on_break). Mirrors TimeClockController::status — break_start is
        // the canonical "on break" marker; break_end/clock_in mean working.
        $now = Carbon::now('Asia/Karachi');
        $lastAction = TimeEntry::forUser($user->id)
            ->forDate($user->attendanceDateFor($now))
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->value('action_type');

        return response()->json([
            'status' => 'ok',
            'last_action' => $lastAction,
            'on_break' => $lastAction === 'break_start',
        ]);
    }

    public function stop(StopSessionRequest $request, TrackingSession $session): JsonResponse
    {
        abort_unless($session->user_id === $request->user()->id, 403);

        $data = $request->validated();

        $stoppedAt = BusinessTime::fromClient($data['stopped_at']) ?? now();
        $session->update([
            'stopped_at' => $stoppedAt,
            'total_seconds' => $this->clampTotalSeconds($session, (int) $data['total_seconds'], $stoppedAt),
            'activity_percent' => $data['activity_percent'] ?? $session->activity_percent,
            'task_note' => $data['task_note'] ?? $session->task_note,
            'status' => TrackingSession::STATUS_STOPPED,
            'last_heartbeat_at' => now(),
        ]);

        $this->sessions->syncWorkHour($session->fresh());

        return response()->json([
            'id' => $session->id,
            'status' => $session->status,
            'stopped_at' => $session->stopped_at?->toIso8601String(),
        ]);
    }

    /**
     * Server backstop: tracked (active, idle-adjusted) seconds can never exceed
     * the session's real elapsed wall-clock. If the desktop reports more — the
     * symptom of the double-timer / double-start bug — cap it to elapsed so an
     * impossible value is never stored, and log it so we're alerted. Legitimate
     * sessions always sit below elapsed, so this only ever corrects the
     * impossible case (no effect on healthy trackers).
     */
    private function clampTotalSeconds(TrackingSession $session, int $incoming, Carbon $endAt): int
    {
        $incoming = max(0, $incoming);
        if (! $session->started_at) {
            return $incoming;
        }

        $elapsed = max(0, $endAt->getTimestamp() - $session->started_at->getTimestamp());
        $grace = 2; // rounding / first-tick slack

        if ($incoming > $elapsed + $grace) {
            Log::warning('Tracking total_seconds exceeded elapsed — clamped', [
                'session_id' => $session->id,
                'user_id' => $session->user_id,
                'reported_seconds' => $incoming,
                'elapsed_seconds' => $elapsed,
                'device_name' => $session->device_name,
                'app_version' => $session->app_version,
            ]);

            return $elapsed;
        }

        return $incoming;
    }

    /**
     * Per-day totals for the trailing 7 days (including today), for the
     * desktop week chart.
     */
    public function week(Request $request): JsonResponse
    {
        // Bucket by the business timezone, not server UTC, so late-evening
        // sessions land on the user's calendar day.
        $today = BusinessTime::today();
        $end = $today->copy()->endOfDay();
        $start = $today->copy()->subDays(6)->startOfDay();

        $perDay = TrackingSession::forUser($request->user()->id)
            ->whereBetween('started_at', BusinessTime::utcRange($start, $end))
            ->get(['started_at', 'total_seconds'])
            ->groupBy(fn (TrackingSession $s) => BusinessTime::dateKey($s->started_at))
            ->map(fn ($group) => (int) $group->sum('total_seconds'));

        $days = [];
        for ($cursor = $start->copy(); $cursor->lte($end); $cursor->addDay()) {
            $iso = $cursor->toDateString();
            $days[] = [
                'date' => $iso,
                'weekday' => $cursor->format('D'),
                'total_seconds' => (int) ($perDay[$iso] ?? 0),
                'is_today' => $cursor->isSameDay($today),
            ];
        }

        return response()->json(['days' => $days]);
    }

    /**
     * The user's most recent distinct clients (last 14 days), newest first.
     * Powers the desktop quick-start chips so switching between regular
     * clients is one click.
     */
    public function recentClients(Request $request): JsonResponse
    {
        $sessions = TrackingSession::forUser($request->user()->id)
            ->with('client:id,name')
            ->whereNotNull('client_id')
            ->where('started_at', '>=', now()->subDays(14))
            ->orderByDesc('started_at')
            ->get(['id', 'client_id', 'work_type', 'task_note', 'started_at']);

        $clients = $sessions
            ->unique('client_id')
            ->take(6)
            ->filter(fn (TrackingSession $session) => $session->client !== null)
            ->map(fn (TrackingSession $session) => [
                'client_id' => $session->client_id,
                'client_name' => $session->client->name,
                'last_work_type' => $session->work_type,
                'last_task_note' => $session->task_note,
                'last_started_at' => $session->started_at?->toIso8601String(),
            ])
            ->values();

        return response()->json(['clients' => $clients]);
    }

    public function today(Request $request): JsonResponse
    {
        $today = BusinessTime::today();

        $sessions = TrackingSession::forUser($request->user()->id)
            ->with(['client:id,name', 'upworkProfile:id,name'])
            ->whereBetween('started_at', BusinessTime::utcRange($today->copy()->startOfDay(), $today->copy()->endOfDay()))
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
