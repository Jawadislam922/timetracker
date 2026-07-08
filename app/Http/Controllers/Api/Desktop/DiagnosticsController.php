<?php

namespace App\Http\Controllers\Api\Desktop;

use App\Http\Controllers\Controller;
use App\Support\Diagnostics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Receives error / telemetry events the desktop tracker uploads so client-side
 * problems (screenshot capture blocked by antivirus, pauses not firing, crashes)
 * are visible on the server without touching the machine. Each event lands in
 * the shared diagnostics store under the 'desktop' category, viewable with
 * `php artisan diagnostics desktop` and on the Developer page.
 */
class DiagnosticsController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'events' => ['required', 'array', 'min:1', 'max:50'],
            'events.*.level' => ['required', Rule::in(['info', 'warn', 'error'])],
            'events.*.event' => ['required', 'string', 'max:80'],
            'events.*.message' => ['nullable', 'string', 'max:2000'],
            'events.*.context' => ['nullable', 'array'],
            'events.*.at' => ['nullable', 'string', 'max:40'],
            'events.*.app_version' => ['nullable', 'string', 'max:20'],
            'events.*.platform' => ['nullable', 'string', 'max:20'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = $request->user();
        $device = $data['device_name'] ?? null;
        $stored = 0;

        foreach ($data['events'] as $e) {
            Diagnostics::capture('desktop', [
                'summary' => sprintf('[%s] %s%s — %s (%s)',
                    strtoupper($e['level']),
                    $e['event'],
                    $device ? ' @'.$device : '',
                    Str::limit($e['message'] ?? '', 120),
                    $user->name,
                ),
                'level' => $e['level'],
                'event' => $e['event'],
                'message' => $e['message'] ?? null,
                'context' => $e['context'] ?? null,
                'client_at' => $e['at'] ?? null,
                'app_version' => $e['app_version'] ?? null,
                'platform' => $e['platform'] ?? null,
                'device_name' => $device,
                'user' => ['id' => $user->id, 'name' => $user->name],
            ], $e['level'].'-'.Str::slug(Str::limit($e['event'], 24, '')));
            $stored++;
        }

        return response()->json(['stored' => $stored]);
    }
}
