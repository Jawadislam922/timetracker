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
            app()->terminating(function () use ($entry) {
                try {
                    app(\App\Services\AttendanceClockNotifier::class)->notify($entry);
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Attendance Slack post failed', ['message' => $e->getMessage()]);
                }
            });
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
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
