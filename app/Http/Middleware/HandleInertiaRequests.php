<?php

namespace App\Http\Middleware;

use App\Models\MonitoringSetting;
use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $lastActionToday = null;
        $authUser = null;

        if ($user) {
            $authUser = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_label' => $user->role_label,
                'avatar' => $user->avatar,
                'avatar_url' => $user->avatar_url,
                'designation' => $user->designation,
                'permissions' => $user->effectivePermissions(),
                'is_super_admin' => $user->isSuperAdmin(),
            ];

            try {
                $today = Carbon::today('Asia/Karachi');
                $entry = TimeEntry::query()
                    ->where('user_id', $user->id)
                    ->whereDate('action_date', $today)
                    ->orderByDesc('action_timestamp')
                    ->first();
                $lastActionToday = $entry?->action_type;
            } catch (\Throwable $e) {
                // Silently ignore to avoid breaking responses
                $lastActionToday = null;
            }
        }

        $teamSettings = null;
        try {
            $row = MonitoringSetting::current();
            $teamSettings = [
                'allow_offline_time' => (bool) $row->allow_offline_time,
                'currency_symbol' => $row->currency_symbol,
                'week_starts_on' => $row->week_starts_on,
            ];
        } catch (\Throwable $e) {
            $teamSettings = null;
        }

        $canCreateManualWorkHour = false;
        if ($user) {
            $canCreateManualWorkHour = $user->isSuperAdmin()
                || $user->hasPermission('work_hours.manage_all')
                || ($teamSettings['allow_offline_time'] ?? false);
        }

        if ($authUser) {
            $authUser['can_create_manual_work_hour'] = $canCreateManualWorkHour;
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $authUser,
                'lastActionToday' => $lastActionToday,
            ],
            'teamSettings' => $teamSettings,
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
        ];
    }
}
