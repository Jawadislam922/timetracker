<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Records real mouse CLICKS (button presses) separately from mouse_count,
     * which lumps in cursor movement and scroll and is therefore useless as a
     * "clicks" figure. Lets the Timeline show an honest keystrokes/clicks pair
     * per screenshot instead of just an activity percentage.
     */
    public function up(): void
    {
        Schema::table('tracking_screenshots', function (Blueprint $table) {
            if (! Schema::hasColumn('tracking_screenshots', 'mouse_clicks')) {
                $table->unsignedInteger('mouse_clicks')->nullable()->after('mouse_count');
            }
        });

        Schema::table('tracking_activity_samples', function (Blueprint $table) {
            if (! Schema::hasColumn('tracking_activity_samples', 'mouse_clicks')) {
                $table->unsignedInteger('mouse_clicks')->default(0)->after('mouse_count');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_screenshots', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_screenshots', 'mouse_clicks')) {
                $table->dropColumn('mouse_clicks');
            }
        });

        Schema::table('tracking_activity_samples', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_activity_samples', 'mouse_clicks')) {
                $table->dropColumn('mouse_clicks');
            }
        });
    }
};
