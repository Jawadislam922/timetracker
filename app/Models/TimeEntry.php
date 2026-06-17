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
    ];

    protected $casts = [
        'action_timestamp' => 'datetime',
        'action_date' => 'date',
        'action_time' => 'datetime:H:i:s',
    ];

    /**
     * Announce every clock-in to the attendance Slack channel ("X clocked in").
     * Fires for web, desktop auto-clock-in, and any other path that creates a
     * clock_in entry. The post runs as a terminating callback so it never adds
     * latency to the clock action itself.
     */
    protected static function booted(): void
    {
        static::created(function (self $entry) {
            if ($entry->action_type !== 'clock_in') {
                return;
            }
            $channel = config('services.attendance.clockin_channel');
            if (! $channel) {
                return;
            }

            app()->terminating(function () use ($entry, $channel) {
                try {
                    app(\App\Services\SlackBotService::class)->postToChannel(
                        $channel,
                        sprintf(
                            ':office: *%s* clocked in at %s.',
                            $entry->user->name ?? 'Someone',
                            $entry->action_timestamp->copy()->setTimezone('Asia/Karachi')->format('g:i A'),
                        ),
                    );
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::warning('Clock-in Slack post failed', ['message' => $e->getMessage()]);
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
