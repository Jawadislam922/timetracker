<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WorkHour extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'date',
        'hours',
        'description',
        'work_type',
        'client_id',
        'tracker',
        'tracking_session_id',
        'source',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function client()
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    /**
     * Clock windows backing a manual entry. The summed window duration equals
     * this row's `hours`; tracker-recorded rows have none.
     */
    public function windows()
    {
        return $this->hasMany(WorkHourWindow::class);
    }
}
