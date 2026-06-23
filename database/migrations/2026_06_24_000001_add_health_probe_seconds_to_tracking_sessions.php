<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('tracking_sessions', 'health_probe_seconds')) {
                // total_seconds snapshot from the last capture-health check. The
                // watchdog compares it to the current total_seconds: unchanged =
                // tracker is paused/idle (no alert), advanced = working but not
                // capturing (likely antivirus block → alert).
                $table->unsignedInteger('health_probe_seconds')->nullable()->after('health_alerted_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_sessions', 'health_probe_seconds')) {
                $table->dropColumn('health_probe_seconds');
            }
        });
    }
};
