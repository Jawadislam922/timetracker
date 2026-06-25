<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The clock-out reminder is now "minutes AFTER the shift ends" (e.g. nudge
     * 20 min past an 8h shift), not an absolute hours threshold. Replacing the
     * column also clears the stray low hour values (0.5 / 1.0) that had been
     * nudging people barely an hour after they clocked in.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'clockout_reminder_minutes')) {
                $table->unsignedSmallInteger('clockout_reminder_minutes')->nullable()->after('shift_hours');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'clockout_reminder_hours')) {
                $table->dropColumn('clockout_reminder_hours');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'clockout_reminder_hours')) {
                $table->decimal('clockout_reminder_hours', 4, 2)->nullable()->after('shift_hours');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'clockout_reminder_minutes')) {
                $table->dropColumn('clockout_reminder_minutes');
            }
        });
    }
};
