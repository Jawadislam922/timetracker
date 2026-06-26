<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A one-day shift change for a single user — e.g. "on Friday I start at 8am
     * for 6h because I'm off Saturday". One row per user per date; absent
     * columns fall back to the user's standing shift. This only changes the
     * SCHEDULE that day (which attendance day a punch buckets to, and when a
     * forgotten clock-out auto-closes). It never creates clock-ins or tracked
     * time, so it cannot inflate hours.
     */
    public function up(): void
    {
        if (Schema::hasTable('user_shift_overrides')) {
            return;
        }

        Schema::create('user_shift_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('date');
            $table->time('shift_start_time')->nullable();
            $table->decimal('shift_hours', 4, 2)->nullable();
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_shift_overrides');
    }
};
