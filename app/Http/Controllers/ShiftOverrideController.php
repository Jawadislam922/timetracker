<?php

namespace App\Http\Controllers;

use App\Models\TrackingAuditLog;
use App\Models\User;
use App\Models\UserShiftOverride;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * One-day shift changes. A member with shift.edit_own manages their OWN upcoming
 * days (today/future only); an admin with shift.manage_all may set or remove a
 * change for anyone, including backdated days. An override only moves that day's
 * schedule (start time / length) — it never creates clock-ins or tracked time,
 * so it cannot inflate hours. {@see User::effectiveShiftFor()} applies it
 * everywhere (bucketing, auto-close, nudges, late detection) automatically.
 */
class ShiftOverrideController extends Controller
{
    /** The member-facing "My Schedule" page: standing shift + upcoming changes. */
    public function index(Request $request)
    {
        $user = $request->user();
        // "Today" for upcoming-changes is judged in the worker's own timezone.
        $today = Carbon::today($user->workTimezone())->toDateString();

        $overrides = $user->shiftOverrides()
            ->whereDate('date', '>=', $today)
            ->orderBy('date')
            ->get()
            ->map(fn (UserShiftOverride $o) => $this->present($o))
            ->values();

        return Inertia::render('MySchedule', [
            'standingShift' => [
                'start_time' => $user->shift_start_time?->format('H:i'),
                'hours' => $user->shift_hours !== null ? (float) $user->shift_hours : null,
                'grace_minutes' => (int) ($user->shift_grace_minutes ?? 0),
            ],
            'overrides' => $overrides,
            'canEdit' => $user->hasPermission('shift.edit_own') || $user->hasPermission('shift.manage_all'),
        ]);
    }

    public function store(Request $request)
    {
        $actor = $request->user();

        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'date' => ['required', 'date_format:Y-m-d'],
            'shift_start_time' => ['nullable', 'date_format:H:i'],
            'shift_hours' => ['nullable', 'numeric', 'min:0', 'max:16'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        // Nothing to change unless a start time and/or a length is given.
        if (empty($data['shift_start_time']) && ($data['shift_hours'] ?? null) === null) {
            throw ValidationException::withMessages([
                'shift_start_time' => 'Set a start time, a length, or both.',
            ]);
        }

        $targetId = $data['user_id'] ?? $actor->id;
        $isSelf = (int) $targetId === (int) $actor->id;

        // Self-service needs shift.edit_own; touching anyone else needs manage_all.
        abort_unless(
            $isSelf ? $actor->hasPermission('shift.edit_own') : $actor->hasPermission('shift.manage_all'),
            403
        );

        $target = $isSelf ? $actor : User::findOrFail($targetId);
        // The override date and the today/future guard are judged in the TARGET
        // worker's own timezone, so a remote worker's "today" is their day.
        $date = Carbon::parse($data['date'], $target->workTimezone())->startOfDay();

        // Without manage_all you can only change today or a future day — never
        // retro-edit a day whose attendance is already settled.
        if (! $actor->hasPermission('shift.manage_all') && $date->lt(Carbon::today($target->workTimezone()))) {
            throw ValidationException::withMessages([
                'date' => 'You can only change your shift for today or a future day.',
            ]);
        }

        $existing = $target->shiftOverrides()->whereDate('date', $date->toDateString())->first();
        $before = $existing
            ? ['shift_start_time' => $existing->shift_start_time?->format('H:i'), 'shift_hours' => $existing->shift_hours !== null ? (float) $existing->shift_hours : null]
            : null;

        UserShiftOverride::updateOrCreate(
            ['user_id' => $target->id, 'date' => $date->toDateString()],
            [
                'shift_start_time' => $data['shift_start_time'] ?? null,
                'shift_hours' => $data['shift_hours'] ?? null,
                'reason' => $data['reason'] ?? null,
                'created_by' => $actor->id,
            ],
        );

        TrackingAuditLog::record([
            'subject_user_id' => $target->id,
            'actor_user_id' => $actor->id,
            'action' => 'shift.override',
            'event_date' => $date->toDateString(),
            'old_value' => $before,
            'new_value' => ['shift_start_time' => $data['shift_start_time'] ?? null, 'shift_hours' => $data['shift_hours'] ?? null],
            'reason' => $data['reason'] ?? null,
        ]);

        return back()->with('success', 'Shift updated for '.$date->format('M j, Y').'.');
    }

    public function destroy(Request $request, UserShiftOverride $shiftOverride)
    {
        $actor = $request->user();
        $isSelf = (int) $shiftOverride->user_id === (int) $actor->id;

        abort_unless(
            $isSelf ? $actor->hasPermission('shift.edit_own') : $actor->hasPermission('shift.manage_all'),
            403
        );

        // Without manage_all you may only cancel a day that hasn't started yet.
        if (! $actor->hasPermission('shift.manage_all')
            && Carbon::parse($shiftOverride->date)->startOfDay()->lt(Carbon::today($shiftOverride->user->workTimezone()))) {
            abort(403);
        }

        TrackingAuditLog::record([
            'subject_user_id' => $shiftOverride->user_id,
            'actor_user_id' => $actor->id,
            'action' => 'shift.override_removed',
            'event_date' => Carbon::parse($shiftOverride->date)->toDateString(),
            'old_value' => ['shift_start_time' => $shiftOverride->shift_start_time?->format('H:i'), 'shift_hours' => $shiftOverride->shift_hours !== null ? (float) $shiftOverride->shift_hours : null],
            'new_value' => null,
            'reason' => null,
        ]);

        $shiftOverride->delete();

        return back()->with('success', 'Shift change removed.');
    }

    private function present(UserShiftOverride $o): array
    {
        $date = Carbon::parse($o->date);

        return [
            'id' => $o->id,
            'date' => $date->toDateString(),
            'date_label' => $date->format('l, M j'),
            'shift_start_time' => $o->shift_start_time?->format('H:i'),
            'shift_hours' => $o->shift_hours !== null ? (float) $o->shift_hours : null,
            'reason' => $o->reason,
        ];
    }
}
