<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\MonitoringSetting;
use App\Models\UpworkProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MetaController extends Controller
{
    public function clients(Request $request): JsonResponse
    {
        $clients = Client::query()
            ->orderBy('name')
            ->get(['id', 'name', 'work_type', 'upwork_profile_id']);

        return response()->json(['clients' => $clients]);
    }

    public function workTypes(): JsonResponse
    {
        return response()->json([
            'work_types' => collect(Client::getWorkTypes())
                ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
                ->values(),
        ]);
    }

    public function upworkProfiles(): JsonResponse
    {
        $profiles = UpworkProfile::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return response()->json(['profiles' => $profiles]);
    }

    public function settings(): JsonResponse
    {
        $settings = MonitoringSetting::current();

        return response()->json([
            'settings' => [
                'screenshot_interval_min_seconds' => $settings->screenshot_interval_min_seconds,
                'screenshot_interval_max_seconds' => $settings->screenshot_interval_max_seconds,
                'idle_threshold_seconds' => $settings->idle_threshold_seconds,
                'activity_sample_interval_seconds' => $settings->activity_sample_interval_seconds,
                'capture_enabled' => $settings->capture_enabled,
                'blur_screenshots' => $settings->blur_screenshots,
                'require_active_window_metadata' => $settings->require_active_window_metadata,
            ],
        ]);
    }
}
