<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-worker WORK timezone: the zone in which THIS worker's day and shift
     * are measured (their home country). Distinct from the per-viewer DISPLAY
     * timezone on user_monitoring_settings. Defaults to 'Asia/Karachi' so every
     * existing user is byte-for-byte unchanged until an admin sets a home zone.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'work_timezone')) {
                $table->string('work_timezone', 64)->default('Asia/Karachi')->after('shift_grace_minutes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'work_timezone')) {
                $table->dropColumn('work_timezone');
            }
        });
    }
};
