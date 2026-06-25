<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One clock window (start_at→end_at) of a manual work-hours entry. Windows are
 * the source of truth for manual time: the parent WorkHour.hours is their
 * summed duration, and the Timeline / gap validation read these directly.
 * Stored in app.timezone wall-clock, matching every other datetime column.
 */
class WorkHourWindow extends Model
{
    use HasFactory;

    protected $fillable = [
        'work_hour_id',
        'start_at',
        'end_at',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
    ];

    public function workHour()
    {
        return $this->belongsTo(WorkHour::class);
    }
}
