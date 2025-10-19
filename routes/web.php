<?php

use App\Http\Controllers\UserController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\PortfolioController;
use App\Http\Controllers\PortfolioUploadController;
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

// Public portfolio view
Route::get('/portfolio/{slug}', [PortfolioController::class, 'showPublic'])->name('portfolio.public');

Route::get('/dashboard', [\App\Http\Controllers\DashboardController::class, 'index'])->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Portfolio management routes
    Route::get('/app/portfolio', [PortfolioController::class, 'index'])->name('portfolio.index');
    Route::get('/app/portfolio/new', [PortfolioController::class, 'create'])->name('portfolio.create');
    Route::post('/app/portfolio', [PortfolioController::class, 'store'])->name('portfolio.store');
    Route::get('/app/portfolio/{id}/edit', [PortfolioController::class, 'edit'])->name('portfolio.edit');
    Route::get('/app/portfolio/{slug}', [PortfolioController::class, 'editBySlug'])->name('portfolio.edit.slug');
    Route::put('/app/portfolio/{id}', [PortfolioController::class, 'update'])->name('portfolio.update');
    Route::post('/app/portfolio/{id}/publish', [PortfolioController::class, 'publish'])->name('portfolio.publish');
    Route::post('/app/upload-image', [PortfolioUploadController::class, 'store'])->name('portfolio.upload');
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
        
        // Employee Attendance routes
        Route::get('/employee-attendance', [\App\Http\Controllers\EmployeeAttendanceController::class, 'index'])->name('employee-attendance.index');
        Route::get('/employee-attendance/summary', [\App\Http\Controllers\EmployeeAttendanceController::class, 'getSummary'])->name('employee-attendance.summary');
        Route::get('/employee-attendance/detailed', [\App\Http\Controllers\EmployeeAttendanceController::class, 'getDetailed'])->name('employee-attendance.detailed');
        Route::get('/employee-attendance/timeline', [\App\Http\Controllers\EmployeeAttendanceController::class, 'getTimeline'])->name('employee-attendance.timeline');
        Route::get('/employee-attendance/export', [\App\Http\Controllers\EmployeeAttendanceController::class, 'export'])->name('employee-attendance.export');
    });

    // Routes accessible to both admin and employee
    Route::resource('work-hours', \App\Http\Controllers\WorkHourController::class)->except(['show']);
    Route::get('/work-hours-export', [\App\Http\Controllers\WorkHourController::class, 'exportPersonal'])->name('work-hours.export-personal');
    Route::post('/work-hours/bulk-delete', [\App\Http\Controllers\WorkHourController::class, 'bulkDelete'])->name('work-hours.bulk-delete');
    
    // Time tracking routes
    Route::prefix('time-entries')->group(function () {
        Route::get('/', [\App\Http\Controllers\TimeEntryController::class, 'index'])->name('time-entries.index');
        Route::post('/', [\App\Http\Controllers\TimeEntryController::class, 'store'])->name('time-entries.store');
        Route::get('/today', [\App\Http\Controllers\TimeEntryController::class, 'getTodaysEntries'])->name('time-entries.today');
        Route::get('/today-summary', [\App\Http\Controllers\TimeEntryController::class, 'getTodaysSummary'])->name('time-entries.today-summary');
        Route::get('/export', [\App\Http\Controllers\TimeEntryController::class, 'export'])->name('time-entries.export');
    });
});

require __DIR__.'/auth.php';
