<?php

namespace App\Support;

use App\Models\TimeEntry;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

/**
 * Debugging tool for the "clock punch filed on the wrong attendance day" bug.
 * When a clock punch is created with action_date != attendanceDateFor(its
 * timestamp), snapshot EVERYTHING needed to pin the cause — the exact request
 * payload (what the desktop actually sent), the code path that created it
 * (backtrace), the server vs DB clock state, and the user's shift config — into
 * a structured JSON file. One file per event; survives log rotation; cat-able
 * over SSH or read back via `php artisan attendance:diagnostics`.
 *
 * Fires only on the rare mismatch, never in the hot path, and can never break a
 * clock action (everything is wrapped).
 */
class AttendanceDiagnostics
{
    private const CLOCK_TYPES = ['clock_in', 'clock_out', 'break_start', 'break_end'];

    /** Directory holding one JSON snapshot per captured mis-file event. */
    public static function dir(): string
    {
        return storage_path('app/diagnostics/attendance');
    }

    public static function captureMisfile(TimeEntry $entry): void
    {
        try {
            $user = $entry->user;
            if (! in_array($entry->action_type, self::CLOCK_TYPES, true) || ! $user) {
                return;
            }

            // Cast accessor (not getRawOriginal) — reliable both in the created
            // hook (where original isn't synced yet) and for loaded rows.
            $stored = $entry->action_date?->format('Y-m-d');
            $correct = $user->attendanceDateFor($entry->action_timestamp);

            if ($stored === $correct) {
                return; // filed correctly — nothing to capture
            }

            $context = [
                'captured_at' => Carbon::now('Asia/Karachi')->toDateTimeString(),
                'entry' => [
                    'id' => $entry->id,
                    'user_id' => $entry->user_id,
                    'user_name' => $user->name,
                    'action_type' => $entry->action_type,
                    'action_timestamp' => (string) $entry->action_timestamp,
                    'stored_action_date' => $stored,
                    'correct_action_date' => $correct,
                    'day_offset' => Carbon::parse($correct)->diffInDays(Carbon::parse($stored), false),
                    'notes' => $entry->notes,
                    'created_at' => (string) $entry->created_at,
                ],
                'user_shift' => [
                    'shift_start_time' => optional($user->shift_start_time)->format('H:i'),
                    'shift_hours' => $user->shift_hours,
                    'work_timezone' => $user->work_timezone,
                    'effective_shift_for_stored' => $stored ? optional($user->effectiveShiftFor($stored)['start_time'])->format('H:i') : null,
                    'effective_shift_for_correct' => optional($user->effectiveShiftFor($correct)['start_time'])->format('H:i'),
                    'override_count' => $user->shiftOverrides->count(),
                ],
                'clock' => self::clockState(),
                'request' => self::requestSnapshot(),
                'backtrace' => self::appBacktrace(),
            ];

            File::ensureDirectoryExists(self::dir());
            $file = self::dir().'/misfile-'.Carbon::now('Asia/Karachi')->format('Ymd-His').'-'.$entry->id.'.json';
            File::put($file, json_encode($context, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            Log::warning('Attendance action_date mismatch captured', [
                'entry_id' => $entry->id,
                'user' => $user->name,
                'stored' => $stored,
                'correct' => $correct,
                'notes' => $entry->notes,
                'via' => $context['request']['route_action'] ?? ($context['request']['context'] ?? null),
                'file' => $file,
            ]);
        } catch (\Throwable $e) {
            // Diagnostics must never break a clock action.
        }
    }

    /** Server clock vs DB clock — the ~5h skew is a live suspect. */
    private static function clockState(): array
    {
        $out = [
            'php_now_karachi' => Carbon::now('Asia/Karachi')->toDateTimeString(),
            'php_now_utc' => Carbon::now('UTC')->toDateTimeString(),
            'php_default_tz' => date_default_timezone_get(),
        ];

        try {
            $db = DB::selectOne('select now() as n, @@session.time_zone as tz');
            $out['db_now'] = $db->n ?? null;
            $out['db_time_zone'] = $db->tz ?? null;
        } catch (\Throwable $e) {
            $out['db_error'] = $e->getMessage();
        }

        return $out;
    }

    /** What the client actually sent — the key unknown. Secrets redacted. */
    private static function requestSnapshot(): array
    {
        try {
            if (app()->runningInConsole() && ! request()->route()) {
                return ['context' => app()->runningInConsole() ? 'console/command' : 'no-request'];
            }

            $r = request();
            $route = $r->route();

            return [
                'method' => $r->method(),
                'url' => $r->fullUrl(),
                'route_name' => $route?->getName(),
                'route_action' => $route?->getActionName(),
                'ip' => $r->ip(),
                'user_agent' => $r->userAgent(),
                'app_version' => $r->header('X-App-Version') ?? $r->header('X-Client-Version'),
                'input' => $r->except(['password', 'password_confirmation', 'token', '_token']),
                'headers' => collect($r->headers->all())
                    ->except(['authorization', 'cookie', 'x-xsrf-token', 'x-csrf-token'])
                    ->map(fn ($v) => is_array($v) ? implode(', ', $v) : $v)
                    ->all(),
            ];
        } catch (\Throwable $e) {
            return ['context' => 'error: '.$e->getMessage()];
        }
    }

    /** App-only stack frames (vendor stripped) so the creating path is obvious. */
    private static function appBacktrace(): array
    {
        $frames = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 60);
        $base = base_path().DIRECTORY_SEPARATOR;
        $out = [];

        foreach ($frames as $f) {
            $file = $f['file'] ?? null;
            if (! $file || str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR)) {
                continue;
            }
            $rel = str_replace($base, '', $file);
            $fn = ($f['class'] ?? '').($f['type'] ?? '').($f['function'] ?? '').'()';
            $out[] = $rel.':'.($f['line'] ?? '?').'  '.$fn;
            if (count($out) >= 15) {
                break;
            }
        }

        return $out;
    }
}
