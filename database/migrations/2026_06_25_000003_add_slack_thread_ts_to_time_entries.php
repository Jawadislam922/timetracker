<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Anchors the per-person, per-day attendance Slack thread. The day's first
     * clock-in stores the parent message ts here; break-start/break-end and
     * clock-out look it up to post as replies, so a person's whole day reads as
     * one Slack thread.
     */
    public function up(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            if (! Schema::hasColumn('time_entries', 'slack_thread_ts')) {
                $table->string('slack_thread_ts')->nullable()->after('notes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('time_entries', function (Blueprint $table) {
            if (Schema::hasColumn('time_entries', 'slack_thread_ts')) {
                $table->dropColumn('slack_thread_ts');
            }
        });
    }
};
