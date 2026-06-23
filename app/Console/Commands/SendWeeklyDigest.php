<?php

namespace App\Console\Commands;

use App\Services\WeeklyDigestService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use RuntimeException;

class SendWeeklyDigest extends Command
{
    protected $signature = 'reports:weekly-digest {--start=} {--end=}';

    protected $description = 'Send the weekly per-person Slack digest (tracked, activity, in-office, gap, late).';

    public function handle(WeeklyDigestService $digest): int
    {
        $tz = config('services.slack_reports.timezone', 'Asia/Karachi');
        $end = $this->option('end')
            ? Carbon::parse($this->option('end'), $tz)->endOfDay()
            : Carbon::now($tz)->subDay()->endOfDay();
        $start = $this->option('start')
            ? Carbon::parse($this->option('start'), $tz)->startOfDay()
            : $end->copy()->subDays(6)->startOfDay();

        try {
            $summary = $digest->sendRange($start, $end);
        } catch (RuntimeException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Weekly digest sent for {$summary['range']['label']} ({$summary['people']} people).");

        return self::SUCCESS;
    }
}
