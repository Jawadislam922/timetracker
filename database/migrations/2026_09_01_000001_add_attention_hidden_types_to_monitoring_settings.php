<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-selectable "Needs Attention" warning types. With the desktop trackers
 * deliberately off fleet-wide, the "Clocked in but not tracking" warning fires
 * for every web-clocked person and floods the dashboard; this lets an admin
 * hide chosen warning types (dashboard panel + Team shift board) from the
 * Settings page instead of alarming HR about what is currently policy.
 * Empty/null = show everything, so deploy changes nothing by itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_settings', function (Blueprint $table) {
            if (! Schema::hasColumn('monitoring_settings', 'attention_hidden_types')) {
                $table->json('attention_hidden_types')->nullable()->after('slack_attendance_channel');
            }
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_settings', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_settings', 'attention_hidden_types')) {
                $table->dropColumn('attention_hidden_types');
            }
        });
    }
};
