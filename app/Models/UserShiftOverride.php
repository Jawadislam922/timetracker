<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * A one-day shift change for a user (see the migration). Absent columns fall
 * back to the standing shift; {@see User::effectiveShiftFor()} resolves the two.
 * Stored in app.timezone wall-clock, like every other datetime column.
 */
class UserShiftOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'shift_start_time',
        'shift_hours',
        'reason',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
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
}
