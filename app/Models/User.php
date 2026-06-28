<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'permissions',
        'include_in_slack_reports',
        'avatar',
        'designation',
        'joining_date',
        'shift_start_time',
        'shift_grace_minutes',
        'work_timezone',
        'shift_hours',
        'clockout_reminder_minutes',
        'allow_multiple_devices',
        'tracks_time',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'permissions',
    ];

    /**
     * Serialized users always carry a resolvable avatar URL; the raw path is
     * only meaningful server-side (the avatars disk may be local or S3).
     *
     * @var array<int, string>
     */
    protected $appends = [
        'avatar_url',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'permissions' => 'array',
        'include_in_slack_reports' => 'boolean',
        'joining_date' => 'date',
        'shift_start_time' => 'datetime:H:i',
        'shift_grace_minutes' => 'integer',
        'shift_hours' => 'decimal:2',
        'clockout_reminder_minutes' => 'integer',
        'allow_multiple_devices' => 'boolean',
        'tracks_time' => 'boolean',
    ];

    const ROLES = [
        'super_admin' => 'Super Admin',
        'admin' => 'Admin',
        'member' => 'Member',
    ];

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return in_array($permission, $this->expandedPermissions(), true);
    }

    public function hasAnyPermission(array $permissions): bool
    {
        return $this->isSuperAdmin()
            || collect($permissions)->contains(fn (string $permission) => $this->hasPermission($permission));
    }

    public function effectivePermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return collect(config('access.permissions'))
                ->flatMap(fn (array $group) => array_keys($group))
                ->values()
                ->all();
        }

        return $this->expandedPermissions();
    }

    public function getRoleLabelAttribute(): string
    {
        return self::ROLES[$this->role] ?? ucfirst(str_replace('_', ' ', $this->role));
    }

    private function expandedPermissions(): array
    {
        $validPermissions = collect(config('access.permissions'))
            ->flatMap(fn (array $group) => array_keys($group))
            ->all();
        $assigned = array_values(array_intersect($this->permissions ?? [], $validPermissions));

        $implications = [
            'users.manage' => ['users.view'],
            'users.delete' => ['users.view'],
            'clients.manage' => ['clients.view'],
            'clients.import_export' => ['clients.view'],
            'profiles.manage' => ['profiles.view'],
            'attendance.manual_mark' => ['attendance.view'],
            'attendance.edit_times' => ['attendance.view'],
            'attendance.export' => ['attendance.view'],
            'shift.manage_all' => ['attendance.view'],
            'reports.export' => ['reports.view'],
            'reports.send_slack' => ['reports.view'],
            'monitoring.manage' => ['monitoring.view'],
            'monitoring.view_screenshots' => ['monitoring.view'],
            'monitoring.delete_screenshots' => ['monitoring.view', 'monitoring.view_screenshots'],
            'monitoring.settings' => ['monitoring.view'],
            'timeline.view_others' => [],
        ];

        foreach ($assigned as $permission) {
            $assigned = [...$assigned, ...($implications[$permission] ?? [])];
        }

        return array_values(array_unique($assigned));
    }

    /**
     * Get the avatar URL attribute.
     *
     * On S3 this is a short-lived signed URL (objects are private); on the
     * local disk it is the public /storage path.
     */
    public function getAvatarUrlAttribute()
    {
        if (! $this->avatar) {
            return null;
        }

        // Stable, cacheable proxy route (see AvatarController). The ?v hash
        // changes only when the avatar file changes, so the browser caches
        // each image for a week instead of re-fetching a fresh presigned S3
        // URL on every page render.
        return route('avatar.show', ['user' => $this->id, 'v' => substr(md5($this->avatar), 0, 8)]);
    }

    /**
     * Get the work hours for the user.
     */
    public function workHours()
    {
        return $this->hasMany(WorkHour::class);
    }

    /**
     * Get the time entries for the user.
     */
    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }

    /**
     * Clocking in up to this many minutes before a shift starts counts toward
     * that shift's attendance day. Without it, an early arrival for a shift
     * starting at/after midnight (e.g. 23:50 for a 00:00 shift) lands on the
     * previous calendar day and "disappears" when the date rolls over.
     */
    public const EARLY_CLOCK_IN_GRACE_MINUTES = 240;

    /**
     * The timezone this worker's day and shift are measured in (their home
     * country). This is the WORK timezone — it decides which attendance day a
     * punch belongs to, when the shift starts/ends, and when auto-close fires.
     * It is deliberately separate from the per-viewer DISPLAY timezone (how a
     * person reading the screen sees times). Defaults to the app timezone
     * (Asia/Karachi) so an unset worker behaves exactly as before.
     */
    public function workTimezone(): string
    {
        return $this->work_timezone ?: config('app.timezone', 'Asia/Karachi');
    }

    public function attendanceDateFor(Carbon $timestamp): string
    {
        $localTimestamp = $timestamp->copy()->setTimezone($this->workTimezone());
        $calendarDate = $localTimestamp->toDateString();

        // Effective shift start for the day this timestamp falls on (honours a
        // one-day override; falls back to the standing shift). With no shift set
        // at all, the attendance day is just the calendar day.
        $startTime = $this->effectiveShiftFor($calendarDate)['start_time'];
        if (! $startTime) {
            return $calendarDate;
        }

        $todayShiftStart = $localTimestamp->copy()->startOfDay()
            ->setTimeFromTimeString($startTime->format('H:i:s'));

        // Early arrival for the NEXT day's shift. Only reachable late in the
        // evening for shifts that start around midnight; day shifts never get
        // within the grace window of tomorrow's start. Measured against
        // tomorrow's own effective start in case it has its own override.
        $tomorrowStart = $this->effectiveShiftFor($localTimestamp->copy()->addDay()->toDateString())['start_time'] ?? $startTime;
        $tomorrowShiftStart = $localTimestamp->copy()->addDay()->startOfDay()
            ->setTimeFromTimeString($tomorrowStart->format('H:i:s'));
        $minutesUntilTomorrowStart = $localTimestamp->diffInMinutes($tomorrowShiftStart, false);

        if ($minutesUntilTomorrowStart >= 0 && $minutesUntilTomorrowStart <= self::EARLY_CLOCK_IN_GRACE_MINUTES) {
            return $tomorrowShiftStart->toDateString();
        }

        if ($localTimestamp->greaterThanOrEqualTo($todayShiftStart)) {
            return $calendarDate;
        }

        // Late-night spillover belonging to the previous day's shift.
        $previousStart = $this->effectiveShiftFor($localTimestamp->copy()->subDay()->toDateString())['start_time'] ?? $startTime;
        $previousShiftStart = $localTimestamp->copy()->subDay()->startOfDay()
            ->setTimeFromTimeString($previousStart->format('H:i:s'));
        $minutesSincePreviousStart = $previousShiftStart->diffInMinutes($localTimestamp, false);

        return $minutesSincePreviousStart >= 0 && $minutesSincePreviousStart <= 12 * 60
            ? $localTimestamp->copy()->subDay()->toDateString()
            : $calendarDate;
    }

    /**
     * One-day shift overrides for this user (see {@see UserShiftOverride}).
     */
    public function shiftOverrides()
    {
        return $this->hasMany(UserShiftOverride::class);
    }

    /**
     * The effective shift for an attendance date: a one-day override when the
     * user set one, otherwise their standing shift. Single source of truth for
     * every shift consumer — bucketing, auto-close, "still working?" nudges and
     * late detection all read this, so a per-day change applies everywhere at
     * once. Returns ['start_time' => ?Carbon, 'hours' => ?float].
     */
    /**
     * Only employees expected to track time. Excludes non-tracking staff (HR,
     * finance, etc.) from team / performance aggregates so they never show as
     * "0% this week". Attendance and the user directory still include everyone.
     */
    public function scopeTracksTime($query)
    {
        return $query->where('tracks_time', true);
    }

    public function effectiveShiftFor(string|Carbon $date): array
    {
        $dateStr = $date instanceof Carbon ? $date->toDateString() : (string) $date;

        // Property access lazy-loads the overrides once and caches them on the
        // instance, so the repeated calls in attendanceDateFor() stay in-memory.
        $override = $this->shiftOverrides->first(
            fn ($o) => optional($o->date)->toDateString() === $dateStr
        );

        $startTime = $this->shift_start_time;
        $hours = $this->shift_hours !== null ? (float) $this->shift_hours : null;

        if ($override) {
            if ($override->shift_start_time) {
                $startTime = $override->shift_start_time;
            }
            if ($override->shift_hours !== null) {
                $hours = (float) $override->shift_hours;
            }
        }

        return ['start_time' => $startTime, 'hours' => $hours];
    }
}
