<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Covering index for the Team Performance top-apps rollups. The page aggregates
 * apps with GROUP BY over a captured_at range for the whole team; the existing
 * (user_id, captured_at) index still made MySQL read each row to fetch
 * active_app. Adding active_app to the index lets both aggregates run index-only
 * (week dropped 25s -> 4s after moving to SQL; this takes week/month the rest of
 * the way down).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_activity_samples', function (Blueprint $table) {
            $table->index(['user_id', 'captured_at', 'active_app'], 'tas_user_captured_app_idx');
        });
    }

    public function down(): void
    {
        Schema::table('tracking_activity_samples', function (Blueprint $table) {
            $table->dropIndex('tas_user_captured_app_idx');
        });
    }
};
