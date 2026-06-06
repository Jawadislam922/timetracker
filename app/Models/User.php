<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     * Note: 'designation' field represents employee shifts (e.g., Morning, Evening, Night)
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'permissions',
        'avatar',
        'designation', // Stores shift information (Morning, Evening, Night, etc.)
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'permissions',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'permissions' => 'array',
    ];

    const ROLES = [
        'super_admin' => 'Super Admin',
        'admin' => 'Admin',
        'member' => 'Member',
    ];

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return in_array($permission, $this->expandedPermissions(), true);
    }

    public function hasAnyPermission(array $permissions): bool
    {
        return $this->isSuperAdmin()
            || collect($permissions)->contains(fn (string $permission) => $this->hasPermission($permission));
    }

    public function effectivePermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return collect(config('access.permissions'))
                ->flatMap(fn (array $group) => array_keys($group))
                ->values()
                ->all();
        }

        return $this->expandedPermissions();
    }

    public function getRoleLabelAttribute(): string
    {
        return self::ROLES[$this->role] ?? ucfirst(str_replace('_', ' ', $this->role));
    }

    private function expandedPermissions(): array
    {
        $validPermissions = collect(config('access.permissions'))
            ->flatMap(fn (array $group) => array_keys($group))
            ->all();
        $assigned = array_values(array_intersect($this->permissions ?? [], $validPermissions));
        $implications = [
            'users.manage' => ['users.view'],
            'users.delete' => ['users.view'],
            'clients.manage' => ['clients.view'],
            'clients.import_export' => ['clients.view'],
            'profiles.manage' => ['profiles.view'],
            'attendance.export' => ['attendance.view'],
            'reports.export' => ['reports.view'],
            'reports.send_slack' => ['reports.view'],
        ];

        foreach ($assigned as $permission) {
            $assigned = [...$assigned, ...($implications[$permission] ?? [])];
        }

        return array_values(array_unique($assigned));
    }

    /**
     * Get the avatar URL attribute.
     */
    public function getAvatarUrlAttribute()
    {
        return $this->avatar
            ? asset('storage/'.$this->avatar)
            : null;
    }

    /**
     * Get the work hours for the user.
     */
    public function workHours()
    {
        return $this->hasMany(WorkHour::class);
    }

    /**
     * Get the time entries for the user.
     */
    public function timeEntries()
    {
        return $this->hasMany(TimeEntry::class);
    }
}
