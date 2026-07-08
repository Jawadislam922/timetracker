<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * App-wide diagnostics store. One structured JSON file per event under
 * storage/app/diagnostics/{category}/ — cat-able over SSH, viewable with
 * `php artisan diagnostics`. Domain captures (attendance, tracker-health) write
 * their own categories here too, so everything is in one place to track errors
 * down across the whole app. Capturing can never throw into the caller.
 */
class Diagnostics
{
    /** Keep at most this many events per category (oldest pruned). */
    private const KEEP_PER_CATEGORY = 300;

    public static function baseDir(): string
    {
        return storage_path('app/diagnostics');
    }

    public static function dir(string $category): string
    {
        return self::baseDir().'/'.preg_replace('/[^a-z0-9\-]/i', '', $category);
    }

    /** Write one diagnostic event. Returns the file path, or null on failure. */
    public static function capture(string $category, array $context, ?string $keyHint = null): ?string
    {
        try {
            $now = Carbon::now('Asia/Karachi');
            $payload = array_merge(['captured_at' => $now->toDateTimeString()], $context);

            $dir = self::dir($category);
            File::ensureDirectoryExists($dir);
            $key = $keyHint ? preg_replace('/[^a-z0-9\-]/i', '', $keyHint) : substr(md5(json_encode($context)), 0, 6);
            $file = $dir.'/'.$now->format('Ymd-His').'-'.$key.'.json';
            File::put($file, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

            self::prune($dir);

            return $file;
        } catch (Throwable $e) {
            return null;
        }
    }

    /**
     * Capture an unhandled/real server error. Skips the everyday non-errors
     * (4xx, validation, auth, CSRF, 404) so the store stays signal, not noise.
     */
    public static function captureException(Throwable $e): void
    {
        try {
            if (self::isNoise($e)) {
                return;
            }

            $file = self::capture('errors', [
                'summary' => class_basename($e).': '.\Illuminate\Support\Str::limit($e->getMessage(), 140),
                'exception' => [
                    'class' => get_class($e),
                    'message' => $e->getMessage(),
                    'code' => $e->getCode(),
                    'file' => str_replace(base_path().DIRECTORY_SEPARATOR, '', $e->getFile()).':'.$e->getLine(),
                    'previous' => $e->getPrevious() ? get_class($e->getPrevious()).': '.$e->getPrevious()->getMessage() : null,
                ],
                'request' => self::requestSnapshot(),
                'trace' => self::appTrace($e),
            ], class_basename($e));

            if ($file) {
                Log::warning('Diagnostics captured error', ['class' => get_class($e), 'file' => $file]);
            }
        } catch (Throwable $ignore) {
            // never let diagnostics turn one error into two
        }
    }

    private static function isNoise(Throwable $e): bool
    {
        if ($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500) {
            return true;
        }

        foreach ([
            ValidationException::class,
            AuthenticationException::class,
            AuthorizationException::class,
            ModelNotFoundException::class,
            TokenMismatchException::class,
            \Illuminate\Http\Exceptions\ThrottleRequestsException::class,
            \Symfony\Component\Routing\Exception\RouteNotFoundException::class,
        ] as $quiet) {
            if ($e instanceof $quiet) {
                return true;
            }
        }

        return false;
    }

    /** Current request context — secrets redacted. Safe in console. */
    public static function requestSnapshot(): array
    {
        try {
            if (app()->runningInConsole() && ! request()->route()) {
                return ['context' => 'console/command', 'user_id' => Auth::id()];
            }

            $r = request();
            $route = $r->route();

            return [
                'method' => $r->method(),
                'url' => $r->fullUrl(),
                'route_name' => $route?->getName(),
                'route_action' => $route?->getActionName(),
                'user_id' => Auth::id(),
                'ip' => $r->ip(),
                'user_agent' => $r->userAgent(),
                'input' => $r->except(['password', 'password_confirmation', 'current_password', 'token', '_token']),
            ];
        } catch (Throwable $e) {
            return ['context' => 'error: '.$e->getMessage()];
        }
    }

    /** App-only stack frames (vendor stripped). */
    public static function appTrace(Throwable $e): array
    {
        $base = base_path().DIRECTORY_SEPARATOR;
        $out = [];

        foreach ($e->getTrace() as $f) {
            $file = $f['file'] ?? null;
            if (! $file || str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR)) {
                continue;
            }
            $out[] = str_replace($base, '', $file).':'.($f['line'] ?? '?').'  '
                .($f['class'] ?? '').($f['type'] ?? '').($f['function'] ?? '').'()';
            if (count($out) >= 20) {
                break;
            }
        }

        return $out;
    }

    private static function prune(string $dir): void
    {
        $files = File::files($dir);
        if (count($files) <= self::KEEP_PER_CATEGORY) {
            return;
        }
        collect($files)
            ->sortBy(fn ($f) => $f->getFilename())
            ->slice(0, count($files) - self::KEEP_PER_CATEGORY)
            ->each(fn ($f) => @unlink($f->getPathname()));
    }
}
