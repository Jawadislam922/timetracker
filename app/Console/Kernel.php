<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        $timezone = config('services.slack_reports.timezone', 'Asia/Karachi');

        if (config('services.slack_reports.weekly_enabled')) {
            $schedule->command('reports:send-weekly-slack')
                ->sundays()
                ->at('10:00')
                ->timezone($timezone)
                ->withoutOverlapping();
        }

        if (config('services.slack_reports.daily_digest_enabled')) {
            $schedule->command('activity:digest-slack')
                ->dailyAt(config('services.slack_reports.daily_digest_time', '09:00'))
                ->timezone($timezone)
                ->withoutOverlapping();
        }

        // Enforce the screenshot retention period from monitoring settings.
        $schedule->command('monitoring:prune-screenshots')
            ->dailyAt('02:30')
            ->timezone($timezone)
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
