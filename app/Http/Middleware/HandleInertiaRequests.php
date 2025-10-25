<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use App\Models\TimeEntry;
use Carbon\Carbon;

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
    public function version(Request $request): string|null
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

        if ($user) {
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
                'user' => $user,
                'lastActionToday' => $lastActionToday,
            ],
        ];
    }
}
