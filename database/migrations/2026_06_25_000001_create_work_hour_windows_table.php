<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Concrete clock windows backing a manual work-hours entry. One manual
     * entry can hold several windows (e.g. 2:30–3:30 and 4:40–6:40); the parent
     * work_hours.hours stays the denormalised sum of these windows so every
     * downstream total keeps working untouched, while the windows are the
     * source of truth for gap validation and the Timeline. Datetimes are stored
     * in app.timezone (Asia/Karachi) wall-clock like every other table; an
     * end_at after midnight is allowed so an overnight window is representable.
     */
    public function up(): void
    {
        if (Schema::hasTable('work_hour_windows')) {
            return;
        }

        Schema::create('work_hour_windows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_hour_id')->constrained()->cascadeOnDelete();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->timestamps();

            $table->index('work_hour_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_hour_windows');
    }
};
