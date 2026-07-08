<?php

namespace App\Support;

use App\Models\TimeEntry;
use App\Models\TrackingActivitySample;
use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use Carbon\Carbon;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Debugging tool for the capture-health watchdog (SilentTrackerCheck). When a
 * live session captures nothing, snapshot the full picture — capture timeline,
 * clock state, heartbeat recency, tracked-seconds vs the last probe, device —
 * and WHY the watchdog decided what it did (alert / on-break skip / paused).
 * Makes "why did I get this notification?" answerable at a glance instead of
 * reconstructing it by hand from the DB.
 *
 * One JSON file per event under storage/app/diagnostics/tracker-health/; read
 * back with `php artisan monitoring:tracker-diagnostics`.
 */
class TrackerHealthDiagnostics
{
    public static function dir(): string
    {
        return storage_path('app/diagnostics/tracker-health');
    }

    public static function capture(TrackingSession $s, string $decision, ?Carbon $lastCapture, Carbon $now): void
    {
        try {
            $lastShot = TrackingScreenshot::where('tracking_session_id', $s->id)->max('captured_at');
            $lastSample = TrackingActivitySample::where('tracking_session_id', $s->id)->max('captured_at');

            $context = [
                'captured_at' => $now->toDateTimeString(),
                'decision' => $decision, // e.g. "ALERTED: av-block" | "skipped: on break" | "skipped: paused"
                'session' => [
                    'id' => $s->id,
                    'user_id' => $s->user_id,
                    'user_name' => optional($s->user)->name,
                    'device_name' => $s->device_name,
                    'source' => $s->source,
                    'status' => $s->status,
                    'started_at' => (string) $s->started_at,
                    'last_heartbeat_at' => (string) $s->last_heartbeat_at,
                    'heartbeat_age_sec' => $s->last_heartbeat_at ? $s->last_heartbeat_at->diffInSeconds($now) : null,
                    'total_seconds' => (int) $s->total_seconds,
                    'health_probe_seconds' => $s->health_probe_seconds,
                    'seconds_advanced_since_probe' => $s->health_probe_seconds !== null ? (int) $s->total_seconds - (int) $s->health_probe_seconds : null,
                    'health_alerted_at' => (string) $s->health_alerted_at,
                    'session_age_min' => $s->started_at ? (int) round($s->started_at->diffInMinutes($now)) : null,
                ],
                'capture' => [
                    'last_screenshot_at' => $lastShot ? (string) $lastShot : null,
                    'last_sample_at' => $lastSample ? (string) $lastSample : null,
                    'last_capture_at' => $lastCapture ? $lastCapture->toDateTimeString() : null,
                    'minutes_since_last_capture' => $lastCapture ? (int) round($lastCapture->diffInMinutes($now)) : null,
                    'screenshots_total' => TrackingScreenshot::where('tracking_session_id', $s->id)->count(),
                    'samples_total' => TrackingActivitySample::where('tracking_session_id', $s->id)->count(),
                ],
                'clock' => [
                    'current_state' => TimeEntry::currentClockState($s->user_id),
                    'today_punches' => TimeEntry::where('user_id', $s->user_id)
                        ->whereDate('action_timestamp', $now->toDateString())
                        ->orderBy('action_timestamp')
                        ->get()
                        ->map(fn ($e) => $e->action_type.' '.$e->action_timestamp->format('H:i:s'))
                        ->all(),
                ],
            ];

            File::ensureDirectoryExists(self::dir());
            $file = self::dir().'/tracker-'.$now->format('Ymd-His').'-s'.$s->id.'.json';
            File::put($file, json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            Log::warning('Tracker-health event captured', [
                'session_id' => $s->id,
                'user' => optional($s->user)->name,
                'device' => $s->device_name,
                'decision' => $decision,
                'clock_state' => $context['clock']['current_state'],
                'file' => $file,
            ]);
        } catch (\Throwable $e) {
            // Diagnostics must never break the watchdog.
        }
    }
}
