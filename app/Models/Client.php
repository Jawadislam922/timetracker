<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Client extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'preferred_contact',
        'contact_notes',
        'tags',
        'work_type',
        'is_active',
        'upwork_profile_id', // Keep for backward compatibility during transition
    ];

    /**
     * How a client prefers to be approached. Order matters: it is the display
     * order in the UI, and Upwork leads because most clients live there — and
     * contacting an Upwork client off-platform can itself breach Upwork ToS,
     * so the preferred channel is genuinely operational information.
     */
    public const PREFERRED_CONTACTS = [
        'upwork' => 'Upwork messages',
        'email' => 'Email',
        'phone' => 'Phone call',
        'whatsapp' => 'WhatsApp',
        'slack' => 'Slack',
    ];

    protected $casts = [
        'tags' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Active (not archived) clients. Archived clients — finished contracts —
     * are hidden from the pickers used to log NEW work, but stay visible in all
     * historical reports and on existing entries that reference them.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeArchived($query)
    {
        return $query->where('is_active', false);
    }

    public function workHours()
    {
        return $this->hasMany(WorkHour::class);
    }

    public function upworkProfile()
    {
        return $this->belongsTo(UpworkProfile::class);
    }

    public function upworkProfiles()
    {
        return $this->belongsToMany(UpworkProfile::class);
    }

    // Define available work types
    public static function getWorkTypes()
    {
        return [
            'tracker_manual' => 'Tracker/Manual Time',
            'fixed' => 'Fixed Client',
            'outside_of_upwork' => 'Outside of Upwork',
        ];
    }

    // Check if upwork profile is required for given work type
    public static function isProfileRequired($workType)
    {
        return in_array($workType, ['tracker_manual', 'fixed']);
    }
}
