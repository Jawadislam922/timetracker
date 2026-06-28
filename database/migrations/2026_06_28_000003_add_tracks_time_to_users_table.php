<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a person is expected to track time. Non-tracking staff (HR, finance,
 * etc.) set this false so they no longer appear at "0% this week" in the
 * performance/team surfaces — they're simply excluded from those aggregates.
 * Defaults true so every existing employee is unchanged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('tracks_time')->default(true);
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('tracks_time');
        });
    }
};
