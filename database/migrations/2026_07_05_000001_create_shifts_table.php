<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Curated, admin-managed list of shift NAMES (Morning / Noon / Evening / Night
 * / …). A user references one via users.shift_id (pick-only — no free text, so
 * no typos). This is distinct from the DERIVED ShiftBand (Day/Evening/Night) and
 * from the free-text `designation` (job title). Shift TIMING stays on the user
 * (shift_start_time / shift_hours) for calculations — a shift here is just a
 * label managers filter and group by.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('shifts')) {
            Schema::create('shifts', function (Blueprint $table) {
                $table->id();
                $table->string('name')->unique();
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();
            });
        }

        // Seed the default shifts in display order (idempotent — never touches
        // an existing row's timestamps).
        foreach (['Morning', 'Noon', 'Evening', 'Night'] as $i => $name) {
            if (! DB::table('shifts')->where('name', $name)->exists()) {
                DB::table('shifts')->insert([
                    'name' => $name,
                    'sort_order' => $i,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shifts');
    }
};
