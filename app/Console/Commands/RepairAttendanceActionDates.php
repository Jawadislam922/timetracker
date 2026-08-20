<?php

namespace App\Console\Commands;

use App\Models\TimeEntry;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use App\Models\User;

/**
 * One-off repair for clock punches filed under the wrong attendance day. A
 * punch's day is authoritatively defined by User::attendanceDateFor() applied
 * to its own action_timestamp; any row whose stored action_date disagrees is
 * mis-filed (the reported bug: a clock-in a minute before shift start stored
 * on the previous day, so it "disappears" from that day's attendance while
 * Slack still announced it). Corrects ONLY rows where the recompute differs —
 * legitimate night-shift spillover already matches and is left untouched.
 *
 * Dry run by default; --apply backs the affected rows up first (fully
 * reversible) and writes via the query builder — never a model re-save, which
 * would shift action_timestamp (the known +5h corruption footgun).
 */
class RepairAttendanceActionDates extends Command
{
    protected $signature = 'attendance:repair-action-dates
        {--since= : Only consider rows with action_timestamp on/after this date (Y-m-d)}
        {--user= : Restrict to a single user id}
        {--apply : Actually update rows (default is a dry run)}';

    protected $description = 'Refile clock punches whose stored action_date disagrees with attendanceDateFor(action_timestamp).';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $since = $this->option('since');
        $userId = $this->option('user');

        $query = TimeEntry::query()
            ->whereIn('action_type', ['clock_in', 'clock_out', 'break_start', 'break_end'])
            ->whereNotNull('action_timestamp')
            ->with(array_merge(['user'], User::shiftEagerLoads('user.')));

        if ($since) {
            $query->whereDate('action_timestamp', '>=', $since);
        }
        if ($userId) {
            $query->where('user_id', (int) $userId);
        }

        $changes = collect();
        $scanned = 0;

        $query->orderBy('id')->chunkById(500, function ($entries) use (&$changes, &$scanned) {
            foreach ($entries as $entry) {
                $scanned++;
                if (! $entry->user) {
                    continue; // orphaned punch — no user to resolve the day
                }
                $stored = $entry->getRawOriginal('action_date');
                $stored = $stored ? substr((string) $stored, 0, 10) : null;
                $correct = $entry->user->attendanceDateFor($entry->action_timestamp);

                if ($stored !== $correct) {
                    $changes->push([
                        'id' => $entry->id,
                        'user_id' => $entry->user_id,
                        'user' => $entry->user->name,
                        'type' => $entry->action_type,
                        'timestamp' => $entry->action_timestamp->toDateTimeString(),
                        'old' => $stored,
                        'new' => $correct,
                    ]);
                }
            }
        });

        $this->info("Scanned {$scanned} clock punches.");

        if ($changes->isEmpty()) {
            $this->info('No mis-filed action_date rows found. Nothing to repair.');

            return self::SUCCESS;
        }

        $this->table(
            ['id', 'user', 'type', 'timestamp', 'stored →', 'correct'],
            $changes->map(fn ($c) => [$c['id'], $c['user'], $c['type'], $c['timestamp'], $c['old'] ?? 'NULL', $c['new']])->all(),
        );
        $this->warn(sprintf('%d mis-filed punches across %d users.', $changes->count(), $changes->pluck('user_id')->unique()->count()));

        if (! $apply) {
            $this->info('Dry run only. Re-run with --apply to back up + repair.');

            return self::SUCCESS;
        }

        $backup = storage_path('app/repairs/attendance-action-dates-'.now()->format('Ymd-His').'.json');
        File::ensureDirectoryExists(dirname($backup));
        File::put($backup, $changes->toJson(JSON_PRETTY_PRINT));
        $this->info('Backup written: '.$backup);

        foreach ($changes as $c) {
            // Query-builder update: writes action_date only, never round-trips
            // the model (which would shift action_timestamp via the tz casts).
            TimeEntry::where('id', $c['id'])->update(['action_date' => $c['new']]);
        }

        $this->info(sprintf('Repaired %d punches — refiled onto their correct attendance day.', $changes->count()));

        return self::SUCCESS;
    }
}
