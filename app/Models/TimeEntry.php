<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'action_type',
        'action_timestamp',
        'action_date',
        'action_time',
        'notes',
        'slack_thread_ts',
    ];

    protected $casts = [
        'action_timestamp' => 'datetime',
        'action_date' => 'date',
        'action_time' => 'datetime:H:i:s',
    ];

    /**
     * Announce clock activity to the attendance Slack channel as one thread per
     * person per day (clock-in is the parent; breaks and clock-out are
     * replies). Fires for web, desktop, and any path that creates the entry.
     * The post runs as a terminating callback so it never adds latency to the
     * clock action itself. {@see \App\Services\AttendanceClockNotifier} holds
     * the threading + gating rules.
     */
    protected static function booted(): void
    {
        static::created(function (self $entry) {
            self::flagMisfiledActionDate($entry);

            app()->terminating(function () use ($entry) {
                try {
                    app(\App\Services\AttendanceClockNotifier::class)->notify($entry);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Attendance Slack post failed', ['message' => $e->getMessage()]);
                }
            });
        });
    }

    /**
     * Diagnostic guard: a clock punch's attendance day must equal
     * attendanceDateFor() applied to its own timestamp. If any write path files
     * it on a different day (reported: a clock-in a minute before shift start
     * landing on the previous day, so it vanishes from that day's attendance),
     * log the exact source — note + request path — so the culprit path can be
     * fixed at the root. Never allowed to break the clock action itself.
     */
    private static function flagMisfiledActionDate(self $entry): void
    {
        try {
            if (! in_array($entry->action_type, ['clock_in', 'clock_out', 'break_start', 'break_end'], true) || ! $entry->user) {
                return;
            }

            $stored = $entry->getRawOriginal('action_date');
            $stored = $stored ? substr((string) $stored, 0, 10) : null;
            $correct = $entry->user->attendanceDateFor($entry->action_timestamp);

            if ($stored !== $correct) {
                \Illuminate\Support\Facades\Log::warning('Attendance action_date mismatch at creation', [
                    'entry_id' => $entry->id,
                    'user_id' => $entry->user_id,
                    'action_type' => $entry->action_type,
                    'action_timestamp' => (string) $entry->action_timestamp,
                    'stored_action_date' => $stored,
                    'correct_action_date' => $correct,
                    'notes' => $entry->notes,
                    'request_path' => request()->path(),
                    'request_method' => request()->method(),
                ]);
            }
        } catch (\Throwable $e) {
            // Diagnostics must never break a clock action.
        }
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }

    /**
     * The user's CURRENT clock state: the action_type of their globally most
     * recent entry, regardless of attendance day. The clock sequence must be
     * enforced against this (not against today's entries only) so a clock-in
     * left open last night still blocks a new clock-in after midnight — you
     * can't clock in while already clocked in. Returns null if they've never
     * clocked anything (then a clock-in is the only allowed action).
     */
    public static function currentClockState(int $userId): ?string
    {
        return static::where('user_id', $userId)
            ->orderByDesc('action_timestamp')->orderByDesc('id')
            ->value('action_type');
    }

    public function scopeForDate($query, $date)
    {
        return $query->whereDate('action_date', $date);
    }

    public function scopeRecent($query, $limit = 50)
    {
        return $query->orderBy('action_timestamp', 'desc')->limit($limit);
    }

    public function getFormattedActionTimeAttribute()
    {
        return $this->action_timestamp->setTimezone('Asia/Karachi')->format('g:i A');
    }

    public function getFormattedActionDateAttribute()
    {
        return $this->action_timestamp->setTimezone('Asia/Karachi')->format('M j, Y');
    }

    public function getFormattedActionTimestampAttribute()
    {
        return $this->action_timestamp->setTimezone('Asia/Karachi')->format('M j, Y g:i A');
    }
}
