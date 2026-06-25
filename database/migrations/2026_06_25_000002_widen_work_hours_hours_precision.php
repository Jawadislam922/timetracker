<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Manual entries are now built from clock windows, and many short windows
     * (e.g. a 4-minute opening = 0.0667h) drift when summed at 2 decimals.
     * Widen hours to decimal(7,4) — the same precision tracker rows already
     * store via round($seconds/3600, 4) — so the parent sum stays exact.
     * Laravel 12 modifies columns natively (no doctrine/dbal required).
     */
    public function up(): void
    {
        Schema::table('work_hours', function (Blueprint $table) {
            $table->decimal('hours', 7, 4)->change();
        });
    }

    public function down(): void
    {
        Schema::table('work_hours', function (Blueprint $table) {
            $table->decimal('hours', 5, 2)->change();
        });
    }
};
