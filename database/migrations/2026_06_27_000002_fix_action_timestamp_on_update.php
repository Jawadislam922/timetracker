<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * time_entries.action_timestamp was created as a MySQL TIMESTAMP with an
     * implicit ON UPDATE CURRENT_TIMESTAMP. On this UTC MySQL server, ANY update
     * to a time_entries row (e.g. the Slack-thread back-fill writing
     * slack_thread_ts) made MySQL auto-rewrite action_timestamp to now()-in-UTC =
     * the real Asia/Karachi time minus 5h, corrupting clock-in instants and
     * making auto-close fire ~5h early (premature clock-outs).
     *
     * Convert it to a plain DATETIME: no ON UPDATE, no implicit default, no
     * server-side timezone conversion. The app stores the Asia/Karachi wall-clock
     * and converts in PHP. The conversion preserves the wall-clock values (MySQL
     * uses the same session timezone the app already reads with), so no data
     * shifts — only the auto-rewrite behaviour is removed.
     */
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE time_entries MODIFY action_timestamp DATETIME NOT NULL');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE time_entries MODIFY action_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
        }
    }
};
