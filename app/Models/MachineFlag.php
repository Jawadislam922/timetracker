<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One durable row per flagged tool on a machine (see the create migration).
 * The compliance dashboard reads this ledger; the desktop ingest keeps it in
 * sync and only alerts on a genuine open/reopen transition.
 */
class MachineFlag extends Model
{
    protected $fillable = [
        'user_id', 'device_name', 'kind', 'rule', 'severity', 'alert', 'label', 'browser_profile', 'signature',
        'status', 'first_seen_at', 'last_seen_at', 'alerted_at', 'resolved_at',
        'acknowledged_by', 'acknowledged_at', 'note', 'app_version', 'platform',
    ];

    protected $casts = [
        'alert' => 'boolean',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'alerted_at' => 'datetime',
        'resolved_at' => 'datetime',
        'acknowledged_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function acknowledger()
    {
        return $this->belongsTo(User::class, 'acknowledged_by');
    }
}
