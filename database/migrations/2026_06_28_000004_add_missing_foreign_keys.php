<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audit PR2 — close two data-integrity gaps:
 *  - work_hours.client_id was indexed but unconstrained, so deleting a client
 *    orphaned its work-hour rows. We add a FK with nullOnDelete (the hours are
 *    preserved as "Unassigned" — historical reporting stays intact).
 *  - attendance_clock_checks.clock_in_id had no FK, so an admin clock-time edit
 *    that deletes the clock-in TimeEntry left a zombie check. We add a cascade FK
 *    (a check is meaningless without its clock-in).
 *
 * Orphan cleanup runs on every driver; the FK constraints are added only on
 * MySQL (the production engine) — SQLite can't add a FK to an existing column
 * via ALTER, and the test DB doesn't need it.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1) Null work-hour rows pointing at a client that no longer exists.
        DB::table('work_hours')
            ->whereNotNull('client_id')
            ->whereNotIn('client_id', fn ($q) => $q->select('id')->from('clients'))
            ->update(['client_id' => null]);

        // 2) Delete clock-checks whose clock-in TimeEntry is gone.
        DB::table('attendance_clock_checks')
            ->whereNotIn('clock_in_id', fn ($q) => $q->select('id')->from('time_entries'))
            ->delete();

        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('work_hours', function (Blueprint $table) {
            $table->foreign('client_id')->references('id')->on('clients')->nullOnDelete();
        });
        Schema::table('attendance_clock_checks', function (Blueprint $table) {
            $table->foreign('clock_in_id')->references('id')->on('time_entries')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            return;
        }

        Schema::table('work_hours', function (Blueprint $table) {
            $table->dropForeign(['client_id']);
        });
        Schema::table('attendance_clock_checks', function (Blueprint $table) {
            $table->dropForeign(['clock_in_id']);
        });
    }
};
