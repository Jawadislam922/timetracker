<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * One era of a user's standing shift: the config that took effect on
 * `effective_from` and stayed in force until the next row (see the migration).
 *
 * This is what makes attendance history stable. Without it, changing someone's
 * shift re-judged every past day against the new time, turning on-time days into
 * "late". {@see User::effectiveShiftFor()} resolves a date to its era; one-day
 * exceptions in {@see UserShiftOverride} still win for their exact date.
 *
 * The row doubles as the audit record — `created_by`, `reason` and the previous
 * era's values say who changed what, when, and from what.
 */
class UserShiftAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'effective_from',
        'shift_start_time',
        'shift_grace_minutes',
        'shift_hours',
        'work_timezone',
        'shift_id',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'shift_start_time' => 'datetime:H:i',
        'shift_hours' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function shift()
    {
        return $this->belongsTo(Shift::class);
    }
}
