<?php

namespace App\Services;

use App\Models\TrackingActivitySample;
use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use App\Models\UpworkProfile;
use App\Models\WorkHour;
use Carbon\CarbonInterface;

class TrackingSessionService
{
    /**
     * Completely remove a tracking session and every trace of it: activity
     * samples, screenshots, and the mirrored work-hours row. Used when an
     * admin deletes a bogus session, when a work-diary entry that mirrors a
     * session is deleted, and when screenshot deletion empties a session to
     * crumbs. Returns the seconds that were removed.
     */
    public function purge(TrackingSession $session): int
    {
        $removed = (int) $session->total_seconds;

        TrackingActivitySample::where('tracking_session_id', $session->id)->delete();
        TrackingScreenshot::where('tracking_session_id', $session->id)->delete();
        WorkHour::where('tracking_session_id', $session->id)->delete();
        $session->delete();

        return $removed;
    }

    /**
     * Close a session and mirror it into work_hours, exactly like a normal
     * desktop "stop". Used both by the stop endpoint and the stale-session
     * sweep (sessions whose desktop app died without sending a stop).
     */
    public function finalize(TrackingSession $session, ?CarbonInterface $stoppedAt = null): void
    {
        $session->update([
            'stopped_at' => $stoppedAt ?? $session->last_heartbeat_at ?? $session->started_at,
            'status' => TrackingSession::STATUS_STOPPED,
        ]);

        $this->syncWorkHour($session->fresh());
    }

    /**
     * Mirror a finished tracking session into the work_hours table so the
     * existing Report sheet auto-populates without manual entry.
     */
    public function syncWorkHour(TrackingSession $session): void
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
    public function normaliseWorkType(?string $workType): ?string
    {
        if ($workType === null || $workType === '') {
            return null;
        }

        return $workType === 'tracker_manual' ? 'tracker' : $workType;
    }
}
