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
            ->with('upworkProfile:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'work_type', 'upwork_profile_id'])
            ->map(fn (Client $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'work_type' => $client->work_type,
                'work_type_label' => Client::getWorkTypes()[$client->work_type] ?? null,
                'upwork_profile_id' => $client->upwork_profile_id,
                'upwork_profile_name' => $client->upworkProfile?->name,
            ]);

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

    public function settings(Request $request): JsonResponse
    {
        $settings = MonitoringSetting::current();
        $effective = $settings->effectiveForUser($request->user());

        return response()->json([
            'settings' => $effective,
        ]);
    }
}
