<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonitoringSetting extends Model
{
    protected $fillable = [
        'screenshot_interval_min_seconds',
        'screenshot_interval_max_seconds',
        'idle_threshold_seconds',
        'activity_sample_interval_seconds',
        'retention_days',
        'blur_screenshots',
        'capture_enabled',
        'require_active_window_metadata',
    ];

    protected $casts = [
        'screenshot_interval_min_seconds' => 'integer',
        'screenshot_interval_max_seconds' => 'integer',
        'idle_threshold_seconds' => 'integer',
        'activity_sample_interval_seconds' => 'integer',
        'retention_days' => 'integer',
        'blur_screenshots' => 'boolean',
        'capture_enabled' => 'boolean',
        'require_active_window_metadata' => 'boolean',
    ];

    public static function current(): self
    {
        return static::firstOrCreate(
            ['id' => 1],
            [
                'screenshot_interval_min_seconds' => 300,
                'screenshot_interval_max_seconds' => 600,
                'idle_threshold_seconds' => 300,
                'activity_sample_interval_seconds' => 60,
                'retention_days' => 60,
                'blur_screenshots' => false,
                'capture_enabled' => true,
                'require_active_window_metadata' => true,
            ]
        );
    }
}
