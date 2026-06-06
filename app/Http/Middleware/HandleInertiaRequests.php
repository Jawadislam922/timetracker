<?php

namespace App\Http\Middleware;

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

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $authUser,
                'lastActionToday' => $lastActionToday,
            ],
        ];
    }
}
