<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Endpoint compliance inventory uploaded by the desktop agent — installed
 * browser extensions, programs, processes, and network/VPN state per machine —
 * so automation tools (refresh tools, scrapers, jigglers) and VPNs that get an
 * Upwork profile flagged can be found from the dashboard instead of visiting
 * each PC. One row per (machine, kind) collection; the latest per pair is the
 * current picture.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('machine_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_name')->nullable();
            $table->string('kind', 32); // extensions | programs | processes | network | history
            $table->timestamp('collected_at')->nullable(); // client clock
            $table->json('items');            // the raw inventory
            $table->json('flagged')->nullable(); // blocklist hits (subset of items + rule)
            $table->unsignedSmallInteger('item_count')->default(0);
            $table->unsignedSmallInteger('flagged_count')->default(0);
            $table->string('app_version', 20)->nullable();
            $table->string('platform', 20)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'kind', 'created_at']);
            $table->index(['device_name', 'kind']);
            $table->index('flagged_count');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('machine_reports');
    }
};
