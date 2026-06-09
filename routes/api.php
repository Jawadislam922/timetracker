<?php

use App\Http\Controllers\Api\Desktop\ActivityController as DesktopActivityController;
use App\Http\Controllers\Api\Desktop\AuthController as DesktopAuthController;
use App\Http\Controllers\Api\Desktop\MetaController as DesktopMetaController;
use App\Http\Controllers\Api\Desktop\ScreenshotController as DesktopScreenshotController;
use App\Http\Controllers\Api\Desktop\SessionController as DesktopSessionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

/*
|--------------------------------------------------------------------------
| Desktop Tracker API (Sanctum token auth)
|--------------------------------------------------------------------------
*/
Route::prefix('desktop')->group(function () {
    Route::post('/login', [DesktopAuthController::class, 'login'])->name('desktop.login');

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [DesktopAuthController::class, 'me'])->name('desktop.me');
        Route::post('/logout', [DesktopAuthController::class, 'logout'])->name('desktop.logout');

        Route::get('/clients', [DesktopMetaController::class, 'clients'])->name('desktop.clients');
        Route::get('/work-types', [DesktopMetaController::class, 'workTypes'])->name('desktop.work-types');
        Route::get('/upwork-profiles', [DesktopMetaController::class, 'upworkProfiles'])->name('desktop.upwork-profiles');
        Route::get('/settings', [DesktopMetaController::class, 'settings'])->name('desktop.settings');

        Route::post('/sessions/start', [DesktopSessionController::class, 'start'])->name('desktop.sessions.start');
        Route::patch('/sessions/{session}/heartbeat', [DesktopSessionController::class, 'heartbeat'])->name('desktop.sessions.heartbeat');
        Route::post('/sessions/{session}/stop', [DesktopSessionController::class, 'stop'])->name('desktop.sessions.stop');
        Route::get('/sessions/today', [DesktopSessionController::class, 'today'])->name('desktop.sessions.today');

        Route::post('/screenshots', [DesktopScreenshotController::class, 'store'])->name('desktop.screenshots.store');
        Route::post('/activity/batch', [DesktopActivityController::class, 'batch'])->name('desktop.activity.batch');
    });
});
