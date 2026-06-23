<?php

namespace App\Services;

use App\Models\TrackingSession;
use App\Models\WorkHour;
use App\Support\BusinessTime;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Per-user tracked time + activity over a date range, computed the same way as
 * the Team page (TrackingSessionService::inDaySeconds for the tracked split,
 * plus manual work-diary hours) so the weekly digest agrees with the dashboards.
 */
class TeamMetricsService
{
    public function __construct(private TrackingSessionService $sessions) {}

    /**
     * @param  array<int>  $userIds
     * @return Collection  keyed by user_id => ['tracked_seconds' => int, 'activity_percent' => int]
     */
    public function forRange(array $userIds, CarbonInterface $start, CarbonInterface $end): Collection
    {
        [$rangeStart, $rangeEnd] = BusinessTime::utcRange($start->copy()->startOfDay(), $end->copy()->endOfDay());

        $byUser = TrackingSession::query()
            ->whereIn('user_id', $userIds)
            ->where('started_at', '<', $rangeEnd)
            ->where(function ($q) use ($rangeStart) {
                $q->whereNull('stopped_at')->orWhere('stopped_at', '>', $rangeStart);
            })
            ->where(function ($q) {
                $q->where('total_seconds', '>=', 60)->orWhere('status', TrackingSession::STATUS_ACTIVE);
            })
            ->get(['id', 'user_id', 'started_at', 'stopped_at', 'total_seconds', 'activity_percent', 'status'])
            ->groupBy('user_id');

        $manualByUser = WorkHour::query()
            ->whereIn('user_id', $userIds)
            ->whereBetween('date', [$rangeStart->toDateString(), $rangeEnd->toDateString()])
            ->where(function ($q) {
                $q->whereNull('source')->orWhere('source', '!=', 'tracker');
            })
            ->get(['user_id', 'hours'])
            ->groupBy('user_id');

        return collect($userIds)->mapWithKeys(function ($id) use ($byUser, $manualByUser, $rangeStart, $rangeEnd) {
            $userSessions = $byUser->get($id, collect());
            $tracked = (int) $userSessions->sum(fn ($s) => $this->sessions->inDaySeconds($s, $rangeStart, $rangeEnd));
            $manualSeconds = (int) round((float) $manualByUser->get($id, collect())->sum('hours') * 3600);

            $weighted = $userSessions->sum(fn ($s) => (int) $s->activity_percent * $this->sessions->inDaySeconds($s, $rangeStart, $rangeEnd));
            $activity = $tracked > 0 ? (int) round($weighted / $tracked) : 0;

            return [$id => [
                'tracked_seconds' => $tracked + $manualSeconds,
                'activity_percent' => $activity,
            ]];
        });
    }
}
