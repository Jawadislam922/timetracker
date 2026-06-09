<?php

namespace App\Http\Controllers;

use App\Models\TrackingScreenshot;
use App\Models\TrackingSession;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MonitoringController extends Controller
{
    public function sessions(Request $request)
    {
        $user = $request->user();
        $canViewAll = $user->hasPermission('monitoring.view');

        $query = TrackingSession::with(['user:id,name,email', 'client:id,name'])
            ->orderBy('started_at', 'desc');

        if (! $canViewAll) {
            $query->where('user_id', $user->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        $sessions = $query->paginate(25)->withQueryString();

        return Inertia::render('Monitoring/SessionsList', [
            'sessions' => $sessions,
            'users' => $canViewAll
                ? User::orderBy('name')->get(['id', 'name'])
                : [],
            'filters' => [
                'user_id' => $request->input('user_id'),
            ],
            'permissions' => [
                'view_screenshots' => $user->hasPermission('monitoring.view_screenshots'),
                'manage' => $user->hasPermission('monitoring.manage'),
            ],
        ]);
    }

    public function showSession(Request $request, TrackingSession $session)
    {
        $user = $request->user();

        if ($session->user_id !== $user->id) {
            abort_unless($user->hasPermission('monitoring.view'), 403);
        }

        $canViewScreenshots = $session->user_id === $user->id
            || $user->hasPermission('monitoring.view_screenshots');

        $session->load(['user:id,name,email', 'client:id,name']);

        $screenshots = $canViewScreenshots
            ? $session->screenshots()->orderBy('captured_at', 'asc')->get([
                'id', 'tracking_session_id', 'captured_at', 'thumbnail_path', 'image_path',
                'activity_percent', 'active_app', 'active_window_title', 'url_domain', 'is_flagged',
            ])->map(function (TrackingScreenshot $s) {
                return [
                    'id' => $s->id,
                    'captured_at' => $s->captured_at?->toIso8601String(),
                    'thumbnail_url' => $s->thumbnail_url,
                    'image_url' => $s->image_url,
                    'activity_percent' => $s->activity_percent,
                    'active_app' => $s->active_app,
                    'active_window_title' => $s->active_window_title,
                    'url_domain' => $s->url_domain,
                    'is_flagged' => $s->is_flagged,
                ];
            })
            : [];

        return Inertia::render('Monitoring/SessionDetail', [
            'session' => $session,
            'screenshots' => $screenshots,
            'permissions' => [
                'view_screenshots' => $canViewScreenshots,
                'delete_screenshots' => $user->hasPermission('monitoring.delete_screenshots'),
            ],
        ]);
    }

    public function screenshotImage(Request $request, TrackingScreenshot $screenshot): StreamedResponse
    {
        $this->authorizeScreenshotAccess($request, $screenshot);

        abort_unless($screenshot->image_path && Storage::disk('screenshots')->exists($screenshot->image_path), 404);

        return Storage::disk('screenshots')->response($screenshot->image_path);
    }

    public function screenshotThumbnail(Request $request, TrackingScreenshot $screenshot): StreamedResponse
    {
        $this->authorizeScreenshotAccess($request, $screenshot);

        $path = $screenshot->thumbnail_path && Storage::disk('screenshots')->exists($screenshot->thumbnail_path)
            ? $screenshot->thumbnail_path
            : $screenshot->image_path;

        abort_unless($path && Storage::disk('screenshots')->exists($path), 404);

        return Storage::disk('screenshots')->response($path);
    }

    private function authorizeScreenshotAccess(Request $request, TrackingScreenshot $screenshot): void
    {
        $user = $request->user();

        if ($screenshot->user_id === $user->id) {
            return;
        }

        abort_unless($user->hasPermission('monitoring.view_screenshots'), 403);
    }
}
