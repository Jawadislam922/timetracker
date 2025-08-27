<?php

use App\Http\Controllers\UserController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ClientController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth', 'verified'])->group(function () {
    // Admin only routes
    Route::middleware(['role:admin'])->group(function () {
        Route::resource('users', UserController::class)->except(['show']);
        Route::get('/report', [\App\Http\Controllers\WorkHourController::class, 'report'])->name('work-hours.report');
        Route::get('/work-hours/export', [\App\Http\Controllers\WorkHourController::class, 'export'])->name('work-hours.export');
        
        // Client export/import routes (must be before resource routes)
        Route::get('/clients/export', [\App\Http\Controllers\ClientController::class, 'export'])->name('clients.export');
        Route::post('/clients/import', [\App\Http\Controllers\ClientController::class, 'import'])->name('clients.import');
        Route::delete('/clients/bulk-destroy', [\App\Http\Controllers\ClientController::class, 'bulkDestroy'])->name('clients.bulk-destroy');
        Route::resource('clients', ClientController::class);
        
        Route::resource('upwork-profiles', \App\Http\Controllers\UpworkProfileController::class);
    });

    // Routes accessible to both admin and employee
    Route::resource('work-hours', \App\Http\Controllers\WorkHourController::class)->except(['show']);
    Route::get('/work-hours-export', [\App\Http\Controllers\WorkHourController::class, 'exportPersonal'])->name('work-hours.export-personal');
    Route::post('/work-hours/bulk-delete', [\App\Http\Controllers\WorkHourController::class, 'bulkDelete'])->name('work-hours.bulk-delete');
});

require __DIR__.'/auth.php';
