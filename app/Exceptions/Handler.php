<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * The list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        // App-wide error capture: every real server error is snapshotted (route,
        // user, input, app stack trace) into the diagnostics store so it can be
        // tracked down with `php artisan diagnostics errors`. Everyday non-errors
        // (4xx/validation/auth) are filtered out inside captureException().
        $this->reportable(function (Throwable $e) {
            \App\Support\Diagnostics::captureException($e);
        });
    }
}
