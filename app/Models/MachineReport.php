<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MachineReport extends Model
{
    protected $fillable = [
        'user_id', 'device_name', 'kind', 'collected_at',
        'items', 'flagged', 'item_count', 'flagged_count', 'app_version', 'platform',
    ];

    protected $casts = [
        'collected_at' => 'datetime',
        'items' => 'array',
        'flagged' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
